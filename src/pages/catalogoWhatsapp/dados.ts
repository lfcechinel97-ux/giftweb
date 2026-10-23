import { supabase } from "@/integrations/supabase/client";
import { COLUNAS_PRODUTO_PUBLICO, type ProdutoPublico } from "@/utils/colunasProdutoPublico";
import { precoUnitario, temPreco } from "@/utils/precoVenda";
import type { ProdutoCatalogo, Recurso } from "./template";

/** Quantidades das três faixas do catálogo (20 / 50 / 100+ un.). */
export const QTDS_FAIXA = [20, 50, 100] as const;

/** Separa a lista colada (quebra de linha, vírgula, ponto e vírgula, espaço) mantendo a ordem. */
export function lerCodigos(texto: string): string[] {
  const vistos = new Set<string>();
  return texto
    .split(/[\s,;]+/)
    .map((c) => c.trim().toUpperCase())
    .filter((c) => c && !vistos.has(c) && vistos.add(c));
}

/** Texto puro da descrição da API (pode vir com HTML e quebras de linha). */
export function limparDescricao(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

/** "17L", "1,2L", "500ML" a partir do nome ou da descrição; "" quando não há. */
export function extrairLitragem(...textos: (string | null | undefined)[]): string {
  for (const t of textos) {
    const s = String(t ?? "");
    const l = s.match(/(\d+(?:[.,]\d+)?)\s*(?:l|lts?|litros?)\b/i);
    if (l) return `${l[1].replace(".", ",")}L`;
    const ml = s.match(/(\d+)\s*ml\b/i);
    if (ml) return `${ml[1]}ML`;
  }
  return "";
}

const SIGLAS = new Set(["usb", "led", "pvc", "tnt", "rpet", "abs", "pu", "eva", "rfid", "pet", "inox"]);

/** Nome que veio TODO EM CAIXA ALTA vira "Título"; o resto fica como está. */
export function ajustarNome(nome: string): string {
  const n = nome.replace(/\s+/g, " ").trim();
  if (n !== n.toUpperCase() || !/[A-ZÀ-Ú]/.test(n)) return n;
  const minusc = new Set(["de", "da", "do", "das", "dos", "e", "com", "para", "em", "a", "o"]);
  return n
    .toLowerCase()
    .split(" ")
    .map((w, i) => {
      if (/\d/.test(w) || SIGLAS.has(w)) return w.toUpperCase(); // 17L, 600D, USB
      if (i > 0 && minusc.has(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}

/**
 * Regras de recurso: padrão na descrição/nome → ícone do dicionário P + texto.
 * A ordem é a prioridade (os 4 primeiros que baterem entram no card).
 */
type Regra = { re: RegExp; i: string; t: (m: RegExpMatchArray) => string };
const REGRAS: Regra[] = [
  {
    re: /(?:notebook|laptop)[^.;]{0,40}?(\d{2}(?:[.,]\d)?)\s*(?:"|”|''|pol)/i,
    i: "notebook",
    t: (m) => `Notebook até ${m[1].replace(".", ",")}”`,
  },
  { re: /notebook|laptop/i, i: "notebook", t: () => "Compartimento p/ notebook" },
  { re: /\busb\b/i, i: "usb", t: () => "Entrada USB" },
  { re: /imperme[aá]vel/i, i: "agua", t: () => "Impermeável" },
  { re: /(?:resistente|repelente)\s+(?:à|a)\s+[aá]gua|water\s*(?:proof|resistant)/i, i: "agua", t: () => "Resistente à água" },
  { re: /antifurto|anti-furto/i, i: "cadeado", t: () => "Sistema antifurto" },
  { re: /t[eé]rmic[ao]|isot[eé]rmic/i, i: "termico", t: () => "Revestimento térmico" },
  { re: /dobr[aá]vel|retr[aá]til/i, i: "dobra", t: () => "Dobrável e compacta" },
  { re: /(?:engate|fita|al[cç]a)[^.;]{0,25}?(?:mala|trolley|carrinho)/i, i: "mala", t: () => "Engate para mala" },
  {
    re: /al[cç]as?[^.;]{0,25}?(acolchoad|ajust[aá]ve|respir[aá]ve|regul[aá]ve)/i,
    i: "alcas",
    t: (m) =>
      /acolchoad/i.test(m[1]) ? "Alças acolchoadas" : /respir/i.test(m[1]) ? "Alças respiráveis" : "Alças ajustáveis",
  },
  {
    re: /(\d+|dois|duas|tr[eê]s|quatro|cinco|m[uú]ltiplos)\s+compartimentos/i,
    i: "camadas",
    t: (m) => (/^\d+$/.test(m[1]) ? `${m[1]} compartimentos` : `${m[1].charAt(0).toUpperCase()}${m[1].slice(1).toLowerCase()} compartimentos`),
  },
  { re: /compartimentos/i, i: "camadas", t: () => "Múltiplos compartimentos" },
  { re: /divis[oó]ri|organizador\s+interno/i, i: "grade", t: () => "Divisórias internas" },
  { re: /bolsos?\s+laterai?s?/i, i: "bolso", t: () => "Bolsos laterais" },
  { re: /bolsos?\s+frontai?s?|bolso\s+frontal/i, i: "bolso", t: () => "Bolso frontal" },
  { re: /refletiv|reflexiv/i, i: "reflexivo", t: () => "Detalhes refletivos" },
  { re: /porta[\s-]?garrafa|porta[\s-]?copo/i, i: "garrafa", t: () => "Porta-garrafa" },
  { re: /z[ií]per/i, i: "ziper", t: () => "Fechamento em zíper" },
  {
    re: /\b(nylon|n[aá]ilon|poli[eé]ster|lona|couro|sint[eé]tico|algod[aã]o|pvc|tnt|rpet)\b/i,
    i: "escudo",
    t: (m) => `Material: ${m[1].charAt(0).toUpperCase()}${m[1].slice(1).toLowerCase()}`,
  },
];

const cm = (v: number | null | undefined) =>
  v && v > 0 ? Number(v.toFixed(1)).toLocaleString("pt-BR") : null;

/** Até 4 recursos derivados da descrição/ficha técnica, um por ícone. */
export function derivarRecursos(p: Pick<ProdutoPublico, "nome" | "descricao" | "altura" | "largura" | "profundidade">): Recurso[] {
  const texto = `${p.nome ?? ""}. ${limparDescricao(p.descricao)}`;
  const out: Recurso[] = [];
  const icones = new Set<string>();
  for (const r of REGRAS) {
    if (out.length >= 4) break;
    if (icones.has(r.i)) continue;
    const m = texto.match(r.re);
    if (!m) continue;
    icones.add(r.i);
    out.push({ i: r.i, t: r.t(m) });
  }
  // ficha técnica: medidas completam o card quando a descrição é curta
  const medidas = [p.altura, p.largura, p.profundidade].map(cm).filter(Boolean);
  if (out.length < 4 && medidas.length >= 2) out.push({ i: "regua", t: `${medidas.join(" x ")} cm` });
  return out;
}

/** Ícone do título do card: o recurso mais marcante, senão a categoria. */
export function iconeDoCard(nome: string, recursos: Recurso[]): string {
  for (const k of ["usb", "dobra", "termico", "cadeado"]) if (recursos.some((r) => r.i === k)) return k;
  if (/mochila|sacochila|bolsa|mala/i.test(nome)) return "mochila";
  if (/garrafa|squeeze|copo|caneca|t[eé]rmic/i.test(nome)) return "garrafa";
  return recursos[0]?.i ?? "caixa";
}

/** URL da foto passando pelo proxy (CORS + 600x600, fundo branco). */
export function fotoProxy(url: string | null | undefined): string {
  if (!url) return "";
  const base = import.meta.env.VITE_SUPABASE_URL as string;
  return `${base}/functions/v1/catalogo-imagem?url=${encodeURIComponent(url)}`;
}

export function placeholder(t: string): string {
  return (
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns='http://www.w3.org/2000/svg' width='600' height='600'><rect width='600' height='600' fill='#ffffff'/><text x='300' y='308' font-family='Arial' font-size='34' fill='#9fb0c4' text-anchor='middle'>${t}</text></svg>`,
    )
  );
}

export function paraCatalogo(p: ProdutoPublico): ProdutoCatalogo {
  const recursos = derivarRecursos(p);
  const nome = ajustarNome(p.nome);
  return {
    codigo: p.codigo_amigavel,
    nome,
    litros: extrairLitragem(p.nome, limparDescricao(p.descricao)),
    icone: iconeDoCard(nome, recursos),
    foto: p.image_url ? fotoProxy(p.image_url) : placeholder(`FOTO ${p.codigo_amigavel}`),
    desc: limparDescricao(p.descricao),
    recursos,
    precos: temPreco(p) ? QTDS_FAIXA.map((q) => precoUnitario(p, q)) : QTDS_FAIXA.map(() => null),
  };
}

/** Quando o código bate em várias linhas (prefixo + cores), escolhe a principal. */
function melhor(a: ProdutoPublico, b: ProdutoPublico): ProdutoPublico {
  const nota = (p: ProdutoPublico) =>
    (p.ativo !== false ? 8 : 0) + (p.is_hidden ? 0 : 4) + (p.has_image ? 2 : 0) + (p.is_variante ? 0 : 1);
  const d = nota(b) - nota(a);
  if (d !== 0) return d > 0 ? b : a;
  return (b.estoque_total ?? b.estoque ?? 0) > (a.estoque_total ?? a.estoque ?? 0) ? b : a;
}

export interface ResultadoBusca {
  produtos: ProdutoCatalogo[];
  naoEncontrados: string[];
  avisos: string[];
}

/**
 * Busca os códigos no products_cache. Aceita o código completo (11329-VM) ou
 * só o prefixo (11329); o completo tem prioridade. Mantém a ordem colada.
 */
export async function buscarProdutos(codigos: string[]): Promise<ResultadoBusca> {
  if (!codigos.length) return { produtos: [], naoEncontrados: [], avisos: [] };
  const [exatos, prefixos] = await Promise.all([
    supabase.from("products_cache").select(COLUNAS_PRODUTO_PUBLICO).in("codigo_amigavel", codigos),
    supabase.from("products_cache").select(COLUNAS_PRODUTO_PUBLICO).in("codigo_prefixo", codigos),
  ]);
  if (exatos.error) throw exatos.error;
  if (prefixos.error) throw prefixos.error;

  const porCodigo = new Map<string, ProdutoPublico>();
  for (const r of (exatos.data ?? []) as unknown as ProdutoPublico[]) porCodigo.set(r.codigo_amigavel.toUpperCase(), r);
  const porPrefixo = new Map<string, ProdutoPublico>();
  for (const r of (prefixos.data ?? []) as unknown as ProdutoPublico[]) {
    const k = String(r.codigo_prefixo ?? "").toUpperCase();
    const atual = porPrefixo.get(k);
    porPrefixo.set(k, atual ? melhor(atual, r) : r);
  }

  const produtos: ProdutoCatalogo[] = [];
  const naoEncontrados: string[] = [];
  const avisos: string[] = [];
  for (const c of codigos) {
    const row = porCodigo.get(c) ?? porPrefixo.get(c);
    if (!row) {
      naoEncontrados.push(c);
      continue;
    }
    if (row.ativo === false || row.is_hidden) avisos.push(`${c}: produto inativo/oculto no site.`);
    if (!temPreco(row)) avisos.push(`${c}: sem preço na API — faixas ficaram "consulte".`);
    if (!row.image_url) avisos.push(`${c}: sem foto na API — clique na foto para enviar uma.`);
    produtos.push(paraCatalogo(row));
  }
  return { produtos, naoEncontrados, avisos };
}
