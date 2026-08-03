import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  TOP10_PREFIXOS,
  TOP10_SECOES,
  type Top10Item,
} from "@/data/top10Xbz";

export interface Top10Cor {
  nome: string;
  imagem: string | null;
  codigo_amigavel?: string | null;
  estoque?: number | null;
}

/** Produto do catálogo já casado com uma linha do ranking da planilha. */
export interface Top10Produto {
  id: string;
  nome: string;
  slug: string | null;
  image_url: string | null;
  image_urls: string[];
  codigo_amigavel: string;
  codigo_prefixo: string;
  preco_custo: number | null;
  tabela_precos: any;
  descricao: string | null;
  estoque: number | null;
  cores: Top10Cor[];
  posicao: number;
  unidVend: number;
  nomePlanilha: string;
}

export interface Top10CategoriaResolvida {
  slug: string;
  label: string;
  secaoSlug: string;
  secaoLabel: string;
  produtos: Top10Produto[];
}

export interface Top10SecaoResolvida {
  slug: string;
  label: string;
  categorias: Top10CategoriaResolvida[];
}

const SELECT =
  "id,nome,slug,image_url,image_urls,cor,preco_custo,estoque,codigo_amigavel,codigo_prefixo,descricao,variantes,tabela_precos";

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function buildCores(row: any): Top10Cor[] {
  const list: Top10Cor[] = [];
  const push = (nome?: string | null, imagem?: string | null, cod?: string | null, estoque?: number | null) => {
    if (!nome) return;
    if (list.some((c) => c.nome === nome)) return;
    list.push({ nome, imagem: imagem ?? null, codigo_amigavel: cod ?? null, estoque: estoque ?? null });
  };
  push(row.cor, row.image_url, row.codigo_amigavel, row.estoque);
  if (Array.isArray(row.variantes)) {
    row.variantes.forEach((v: any) => push(v?.cor, v?.image, v?.codigo_amigavel, v?.estoque));
  }
  return list;
}

function buildGaleria(row: any): string[] {
  const imgs: string[] = [];
  const add = (u?: string | null) => {
    if (u && !imgs.includes(u)) imgs.push(u);
  };
  add(row.image_url);
  if (Array.isArray(row.image_urls)) row.image_urls.forEach(add);
  if (Array.isArray(row.variantes)) row.variantes.forEach((v: any) => add(v?.image));
  return imgs;
}

async function fetchProdutos() {
  const groups = chunk(TOP10_PREFIXOS, 60);
  const results = await Promise.all(
    groups.map(async (g) => {
      const { data, error } = await supabase
        .from("products_cache")
        .select(SELECT)
        .in("codigo_prefixo", g)
        .eq("ativo", true)
        .eq("has_image", true)
        .eq("is_variante", false)
        .neq("is_hidden", true);
      if (error) throw error;
      return data ?? [];
    })
  );
  const map = new Map<string, any>();
  results.flat().forEach((row: any) => {
    if (!row?.codigo_prefixo) return;
    const prev = map.get(row.codigo_prefixo);
    // mantém o registro com mais estoque quando há duplicidade
    if (!prev || (row.estoque ?? 0) > (prev.estoque ?? 0)) map.set(row.codigo_prefixo, row);
  });
  return map;
}

async function fetchAjustes() {
  const { data, error } = await supabase
    .from("top10_xbz_ajustes" as any)
    .select("codigo_prefixo, ativo, ordem_override");
  if (error) throw error;
  const map = new Map<string, { ativo: boolean; ordem_override: number | null }>();
  (data as any[] | null)?.forEach((r) =>
    map.set(r.codigo_prefixo, { ativo: r.ativo !== false, ordem_override: r.ordem_override ?? null })
  );
  return map;
}

function toProduto(row: any, item: Top10Item, ordem: number): Top10Produto {
  return {
    id: row.id,
    nome: row.nome ?? item.nomePlanilha,
    slug: row.slug ?? null,
    image_url: row.image_url ?? null,
    image_urls: buildGaleria(row),
    codigo_amigavel: row.codigo_amigavel ?? item.codigoPrefixo,
    codigo_prefixo: item.codigoPrefixo,
    preco_custo: row.preco_custo != null ? Number(row.preco_custo) : null,
    tabela_precos: row.tabela_precos ?? null,
    descricao: row.descricao ?? null,
    estoque: row.estoque ?? null,
    cores: buildCores(row),
    posicao: ordem,
    unidVend: item.unidVend,
    nomePlanilha: item.nomePlanilha,
  };
}

export function useTop10Xbz() {
  return useQuery({
    queryKey: ["top10-xbz"],
    queryFn: async (): Promise<Top10SecaoResolvida[]> => {
      const [produtos, ajustes] = await Promise.all([fetchProdutos(), fetchAjustes()]);

      return TOP10_SECOES.map((sec) => ({
        slug: sec.slug,
        label: sec.label,
        categorias: sec.categorias.map((cat) => {
          const lista = cat.itens
            .map((item) => {
              const aj = ajustes.get(item.codigoPrefixo);
              if (aj && aj.ativo === false) return null;
              const row = produtos.get(item.codigoPrefixo);
              if (!row) return null;
              return toProduto(row, item, aj?.ordem_override ?? item.posicao);
            })
            .filter((p): p is Top10Produto => !!p)
            .sort((a, b) => a.posicao - b.posicao);
          return {
            slug: cat.slug,
            label: cat.label,
            secaoSlug: sec.slug,
            secaoLabel: sec.label,
            produtos: lista,
          };
        }).filter((c) => c.produtos.length > 0),
      })).filter((s) => s.categorias.length > 0);
    },
    staleTime: 60_000,
  });
}

/** Lista achatada de categorias resolvidas (útil para chips de navegação). */
export function flattenCategorias(secoes: Top10SecaoResolvida[] | undefined) {
  return (secoes ?? []).flatMap((s) => s.categorias);
}
