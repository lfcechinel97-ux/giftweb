import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { configsMaster, type ConfigMaster, type LinhaMaster } from "./caixaMaster";
import type { Override, ProdutoApi } from "./fontes";
import { medida, normalizar } from "./regras";

/* Leitura do banco. As medidas da XBZ vêm do products_cache (sincronizado
   todo dia pela sync-products); a página nunca chama a API da XBZ. */

// As tabelas novas ainda não estão nos tipos gerados do Supabase.
export const db = supabase as unknown as SupabaseClient;

const PAGINA = 1000;

/** Lê uma tabela inteira em páginas paralelas (o PostgREST devolve no máx. 1000 por vez). */
async function lerTudo<T>(tabela: string, colunas: string): Promise<T[]> {
  const base = () => db.from(tabela).select(colunas, { count: "exact" });
  const primeira = await base().order("id").range(0, PAGINA - 1);
  if (primeira.error) throw new Error(`${tabela}: ${primeira.error.message}`);
  const total = primeira.count ?? primeira.data.length;
  const resto = [];
  for (let ini = PAGINA; ini < total; ini += PAGINA) resto.push(base().order("id").range(ini, ini + PAGINA - 1));
  const paginas = await Promise.all(resto);
  const out = [...(primeira.data as T[])];
  for (const p of paginas) {
    if (p.error) throw new Error(`${tabela}: ${p.error.message}`);
    out.push(...(p.data as T[]));
  }
  return out;
}

export interface Variante {
  codigoComposto: string;
  cor: string | null;
  estoque: number;
}

/** Um produto (CodigoAmigavel), com as cores como variantes. */
export interface ProdutoIndice {
  codigo: string;
  nome: string;
  imagem: string | null;
  estoque: number;
  ativo: boolean;
  variantes: Variante[];
  api: ProdutoApi;
  busca: string;
}

interface LinhaCache {
  codigo_amigavel: string;
  codigo_prefixo: string | null;
  nome: string;
  cor: string | null;
  peso: number | null;
  altura: number | null;
  largura: number | null;
  profundidade: number | null;
  image_url: string | null;
  estoque: number | null;
  ativo: boolean | null;
}

const completude = (l: LinhaCache) => [l.peso, l.altura, l.largura, l.profundidade].filter((v) => medida(v)).length;

export async function carregarProdutos(): Promise<ProdutoIndice[]> {
  const linhas = await lerTudo<LinhaCache>(
    "products_cache",
    "codigo_amigavel, codigo_prefixo, nome, cor, peso, altura, largura, profundidade, image_url, estoque, ativo",
  );
  const grupos = new Map<string, LinhaCache[]>();
  for (const l of linhas) {
    const codigo = (l.codigo_prefixo || l.codigo_amigavel).trim();
    const g = grupos.get(codigo);
    if (g) g.push(l); else grupos.set(codigo, [l]);
  }
  const out: ProdutoIndice[] = [];
  for (const [codigo, g] of grupos) {
    // Cores do mesmo produto compartilham a medida: usa a linha mais completa
    const ref = g.reduce((a, b) => (completude(b) > completude(a) ? b : a));
    const comImagem = g.find((l) => l.image_url && !l.image_url.includes("placehold")) ?? ref;
    const nome = ref.nome.replace(/\s*-\s*[A-Z]{2,4}$/, "");
    const variantes = g
      .map((l) => ({ codigoComposto: l.codigo_amigavel, cor: l.cor, estoque: l.estoque ?? 0 }))
      .sort((a, b) => a.codigoComposto.localeCompare(b.codigoComposto));
    out.push({
      codigo, nome,
      imagem: comImagem.image_url,
      estoque: variantes.reduce((s, v) => s + Math.max(0, v.estoque), 0),
      ativo: g.some((l) => l.ativo !== false),
      variantes,
      api: { codigo, nome, pesoG: medida(ref.peso), altura: medida(ref.altura), largura: medida(ref.largura), profundidade: medida(ref.profundidade) },
      busca: normalizar(`${codigo} ${variantes.map((v) => v.codigoComposto).join(" ")} ${nome}`),
    });
  }
  return out;
}

/** Busca por código (amigável ou composto) ou nome. Todas as palavras precisam aparecer. */
export function buscarProdutos(indice: ProdutoIndice[], termo: string, limite = 20): ProdutoIndice[] {
  const q = normalizar(termo).trim();
  if (!q) return [];
  const palavras = q.split(/\s+/);
  const achados: { p: ProdutoIndice; nota: number }[] = [];
  for (const p of indice) {
    if (!palavras.every((w) => p.busca.includes(w))) continue;
    const cod = normalizar(p.codigo);
    let nota = 0;
    if (cod === q || p.variantes.some((v) => normalizar(v.codigoComposto) === q)) nota = 3;
    else if (cod.startsWith(q)) nota = 2;
    else if (normalizar(p.nome).startsWith(q)) nota = 1;
    achados.push({ p, nota });
  }
  achados.sort((a, b) => b.nota - a.nota || Number(b.p.ativo) - Number(a.p.ativo) || b.p.estoque - a.p.estoque);
  return achados.slice(0, limite).map((a) => a.p);
}

export interface MasterProduto {
  /** todas as configurações válidas do produto. */
  todas: ConfigMaster[];
  /** por cor (CodigoComposto). */
  porVariante: Map<string, ConfigMaster[]>;
  emRevisao: number;
}

type LinhaMasterDb = Pick<LinhaMaster, "codigo_composto" | "qtd_por_caixa" | "largura_cm" | "altura_cm" | "comprimento_cm" | "status_revisao">;

export async function carregarMaster(produtos: ProdutoIndice[]): Promise<{ porProduto: Map<string, MasterProduto>; importadoEm: string | null; total: number }> {
  const linhas = await lerTudo<LinhaMasterDb & { importado_em: string }>(
    "xbz_caixa_master",
    "id, codigo_composto, qtd_por_caixa, largura_cm, altura_cm, comprimento_cm, status_revisao, importado_em",
  );
  const produtoDe = new Map<string, string>();
  for (const p of produtos) for (const v of p.variantes) produtoDe.set(normalizar(v.codigoComposto), p.codigo);
  const brutas = new Map<string, LinhaMasterDb[]>();
  for (const l of linhas) {
    const cod = produtoDe.get(normalizar(l.codigo_composto));
    if (!cod) continue;
    const g = brutas.get(cod);
    if (g) g.push(l); else brutas.set(cod, [l]);
  }
  const porProduto = new Map<string, MasterProduto>();
  for (const [cod, g] of brutas) {
    const porVariante = new Map<string, ConfigMaster[]>();
    for (const l of g) {
      const k = normalizar(l.codigo_composto);
      const c = configsMaster([l]);
      if (c.length) porVariante.set(k, [...(porVariante.get(k) ?? []), ...c]);
    }
    porProduto.set(cod, { todas: configsMaster(g), porVariante, emRevisao: g.filter((l) => l.status_revisao === "revisar").length });
  }
  return { porProduto, importadoEm: linhas[0]?.importado_em ?? null, total: linhas.length };
}

export interface OverrideDb extends Override {
  codigo_amigavel: string;
  observacao: string | null;
  atualizado_em: string;
}

export async function carregarOverrides(): Promise<Map<string, OverrideDb>> {
  const { data, error } = await db.from("medidas_override").select("*");
  if (error) throw new Error(`medidas_override: ${error.message}`);
  return new Map((data as OverrideDb[]).map((o) => [o.codigo_amigavel, o]));
}

export interface Config {
  caixa: { largura: number; altura: number; comprimento: number };
  pesoMaxKg: number;
  taraKg: number;
  aproveitamentoApi: number;
  aproveitamentoMaster: number;
  cubagemRodoviario: number;
  cubagemAereo: number;
}

export const CONFIG_PADRAO: Config = {
  caixa: { largura: 60, altura: 40, comprimento: 40 },
  pesoMaxKg: 25, taraKg: 0, aproveitamentoApi: 0.85, aproveitamentoMaster: 0.9,
  cubagemRodoviario: 300, cubagemAereo: 167,
};

export async function carregarConfig(): Promise<Config> {
  const { data, error } = await db.from("calc_config").select("chave, valor");
  if (error) throw new Error(`calc_config: ${error.message}`);
  const m = new Map((data as { chave: string; valor: unknown }[]).map((r) => [r.chave, r.valor]));
  const num = (k: string, padrao: number) => medida(m.get(k)) ?? padrao;
  const cx = m.get("caixa_padrao") as Partial<Config["caixa"]> | undefined;
  return {
    caixa: {
      largura: medida(cx?.largura) ?? CONFIG_PADRAO.caixa.largura,
      altura: medida(cx?.altura) ?? CONFIG_PADRAO.caixa.altura,
      comprimento: medida(cx?.comprimento) ?? CONFIG_PADRAO.caixa.comprimento,
    },
    pesoMaxKg: num("peso_max_kg", CONFIG_PADRAO.pesoMaxKg),
    taraKg: medida(m.get("tara_kg")) ?? 0,
    aproveitamentoApi: num("fator_aproveitamento_api", CONFIG_PADRAO.aproveitamentoApi),
    aproveitamentoMaster: num("fator_aproveitamento_master", CONFIG_PADRAO.aproveitamentoMaster),
    cubagemRodoviario: num("fator_cubagem_rodoviario", CONFIG_PADRAO.cubagemRodoviario),
    cubagemAereo: num("fator_cubagem_aereo", CONFIG_PADRAO.cubagemAereo),
  };
}

export async function ultimaSync(): Promise<string | null> {
  const { data } = await supabase.from("sync_log").select("synced_at")
    .like("status", "success%").order("synced_at", { ascending: false }).limit(1).maybeSingle();
  return data?.synced_at ?? null;
}
