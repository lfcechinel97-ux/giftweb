import { useQuery } from "@tanstack/react-query";
import { useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type SistemaProduct = Tables<"products_cache">;

const SELECT_COLS =
  "id,nome,slug,codigo_amigavel,codigo_prefixo,image_url,image_urls,preco_custo,estoque,estoque_total,categoria,tabela_precos,variantes,variantes_count,is_variante,is_hidden,produto_pai,ativo,has_image,cor,altura,largura";

const CHUNK = 1000;
const MAX_TOTAL = 20000;

/** Extrai o prefixo de um código: "02087-AZU" → "02087", "02087" → "02087" */
function extractPrefixo(codigo: string): string {
  if (!codigo) return "";
  const idx = codigo.indexOf("-");
  return idx > 0 ? codigo.slice(0, idx) : codigo;
}

/** Busca TODOS os produtos ativos — sem filtrar has_image, is_hidden, is_variante.
 *  Para uso interno do sistema de vendas. */
async function fetchAllProducts(): Promise<SistemaProduct[]> {
  const all: SistemaProduct[] = [];
  let from = 0;
  let to = CHUNK - 1;
  while (all.length < MAX_TOTAL) {
    const { data, error } = await supabase
      .from("products_cache")
      .select(SELECT_COLS)
      .eq("ativo", true)
      .order("codigo_amigavel", { ascending: true })
      .range(from, to);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...(data as SistemaProduct[]));
    if (data.length < CHUNK) break;
    from += CHUNK;
    to += CHUNK;
  }
  return all;
}

export interface SistemaProductsResult {
  /** Todos os produtos (pais + variantes) */
  allProducts: SistemaProduct[];
  /** Um representante por grupo de prefixo (usado na lista de busca) */
  parentProducts: SistemaProduct[];
  /** Apenas variantes (is_variante = true) */
  variants: SistemaProduct[];
  isLoading: boolean;
  error: Error | null;
  /** Busca representantes por texto — retorna até 30, um por grupo */
  searchParents: (term: string) => SistemaProduct[];
  /** Busca produto+variantes pelo codigo_amigavel (ou prefixo) */
  getParentWithVariants: (codigoAmigavel: string) => { parent: SistemaProduct; variants: SistemaProduct[] } | null;
  /** Dado um codigoComposto (ex: "08338-BCO"), separa pai e variante */
  resolveCodigoComposto: (codigo: string) => { parent: SistemaProduct | null; variant: SistemaProduct | null };
}

export function useSistemaProducts(): SistemaProductsResult {
  const {
    data = [],
    isLoading,
    error,
  } = useQuery<SistemaProduct[]>({
    queryKey: ["sistema", "all-products"],
    queryFn: fetchAllProducts,
    staleTime: 5 * 60 * 1000,
  });

  const allProducts = data;

  const variants = useMemo(() => allProducts.filter((p) => p.is_variante), [allProducts]);

  /**
   * "parentProducts" = um representante por grupo de prefixo.
   * Como no banco não existe produto-pai real (produto_pai vazio na maioria),
   * usamos o primeiro produto de cada grupo de prefixo como representante.
   * Prioridade: produto com is_variante=false > primeiro do grupo ordenado por codigo_amigavel.
   */
  const parentProducts = useMemo(() => {
    const map = new Map<string, SistemaProduct>();
    for (const p of allProducts) {
      const prefixo = extractPrefixo(p.codigo_amigavel);
      if (!map.has(prefixo)) {
        map.set(prefixo, p);
      } else {
        // Prefere produto com is_variante = false (produto pai real)
        const current = map.get(prefixo)!;
        if (!p.is_variante && current.is_variante) {
          map.set(prefixo, p);
        }
      }
    }
    return Array.from(map.values());
  }, [allProducts]);

  /**
   * Busca representantes por texto (nome ou código).
   * Retorna até 30, um por grupo de prefixo.
   */
  const searchParents = useCallback(
    (term: string): SistemaProduct[] => {
      const t = term.trim().toLowerCase();

      // Filtra todos os produtos pelo termo
      const candidates = t
        ? allProducts.filter((p) => p.nome.toLowerCase().includes(t) || p.codigo_amigavel.toLowerCase().includes(t))
        : allProducts;

      // Deduplica por prefixo — mostra só 1 representante por grupo
      const seen = new Set<string>();
      const result: SistemaProduct[] = [];
      for (const p of candidates) {
        const prefixo = extractPrefixo(p.codigo_amigavel);
        if (!seen.has(prefixo)) {
          seen.add(prefixo);
          // Usa o representante canônico do grupo (pode ter is_variante=false)
          const rep = parentProducts.find((pp) => extractPrefixo(pp.codigo_amigavel) === prefixo) ?? p;
          result.push(rep);
        }
        if (result.length >= 30) break;
      }
      return result;
    },
    [allProducts, parentProducts],
  );

  /**
   * Retorna { parent, variants } para um dado código.
   *
   * Funciona em dois casos:
   * 1. produto_pai preenchido no banco → usa vinculação direta
   * 2. produto_pai vazio (caso XBZ) → agrupa por prefixo do código
   *
   * Aceita tanto o código completo ("02087-AZU") quanto só o prefixo ("02087").
   */
  const getParentWithVariants = useCallback(
    (codigoAmigavel: string): { parent: SistemaProduct; variants: SistemaProduct[] } | null => {
      if (!codigoAmigavel) return null;

      const prefixo = extractPrefixo(codigoAmigavel);

      // Tenta primeiro: produto pai real (is_variante = false) com esse prefixo
      const realParent = allProducts.find((p) => !p.is_variante && extractPrefixo(p.codigo_amigavel) === prefixo);

      if (realParent) {
        // Caso com produto pai real no banco
        const pvars = allProducts.filter(
          (p) =>
            p.id !== realParent.id &&
            (p.produto_pai === realParent.id || extractPrefixo(p.codigo_amigavel) === prefixo),
        );
        return { parent: realParent, variants: pvars };
      }

      // Caso XBZ: sem produto pai real — agrupa todas as variantes pelo prefixo
      const grupo = allProducts.filter((p) => extractPrefixo(p.codigo_amigavel) === prefixo);

      if (grupo.length === 0) {
        // Último recurso: match exato
        const exact = allProducts.find((p) => p.codigo_amigavel === codigoAmigavel || p.id === codigoAmigavel);
        if (!exact) return null;
        return { parent: exact, variants: [] };
      }

      // O "pai" é o representante canônico do grupo (primeiro por ordem de código)
      const parent = grupo[0];
      // As variantes são todos os outros do grupo
      const pvars = grupo.slice(1);

      return { parent, variants: pvars };
    },
    [allProducts],
  );

  /** Resolve "08338-BCO" → busca produto com codigo_amigavel exato, ou
   *  tenta separar prefixo+sufixo para encontrar pai e variante. */
  const resolveCodigoComposto = useCallback(
    (codigo: string): { parent: SistemaProduct | null; variant: SistemaProduct | null } => {
      const upper = codigo.toUpperCase().trim();

      // 1. Correspondência exata em qualquer produto
      const exact = allProducts.find((p) => p.codigo_amigavel.toUpperCase() === upper);
      if (exact) {
        const result = getParentWithVariants(exact.codigo_amigavel);
        if (!result) return { parent: exact, variant: null };
        const variant = result.variants.find((v) => v.id === exact.id) ?? null;
        return { parent: result.parent, variant: exact.id === result.parent.id ? null : exact };
      }

      // 2. Tenta "PREFIXO-SUFIXO"
      const lastDash = upper.lastIndexOf("-");
      if (lastDash > 0) {
        const prefixo = upper.slice(0, lastDash);
        const sufixo = upper.slice(lastDash + 1);
        const result = getParentWithVariants(prefixo);
        if (result) {
          const variant =
            result.variants.find((v) => v.cor?.toUpperCase() === sufixo || v.codigo_amigavel.toUpperCase() === upper) ??
            null;
          return { parent: result.parent, variant };
        }
      }

      return { parent: null, variant: null };
    },
    [allProducts, getParentWithVariants],
  );

  return {
    allProducts,
    parentProducts,
    variants,
    isLoading,
    error: error as Error | null,
    searchParents,
    getParentWithVariants,
    resolveCodigoComposto,
  };
}

// ─── Helpers standalone (para uso fora do hook) ──────────────────────────────

export async function searchProductsParents(term: string, limit = 60): Promise<SistemaProduct[]> {
  const t = (term || "").trim();
  let query = supabase
    .from("products_cache")
    .select(SELECT_COLS)
    .eq("ativo", true)
    .order("codigo_amigavel", { ascending: true })
    .limit(limit);
  if (t) query = query.or(`nome.ilike.%${t}%,codigo_amigavel.ilike.%${t}%`);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as SistemaProduct[];
}

export async function fetchProductById(id: string): Promise<SistemaProduct | null> {
  const { data, error } = await supabase.from("products_cache").select(SELECT_COLS).eq("id", id).single();
  if (error || !data) return null;
  return data as SistemaProduct;
}

export async function fetchVariantsByParentId(parentId: string): Promise<SistemaProduct[]> {
  const { data, error } = await supabase
    .from("products_cache")
    .select(SELECT_COLS)
    .eq("produto_pai", parentId)
    .eq("ativo", true)
    .order("codigo_amigavel", { ascending: true });
  if (error || !data) return [];
  return data as SistemaProduct[];
}

export function stockLevel(estoque: number, ajusteReserva = 0): "alto" | "medio" | "baixo" | "zero" {
  const s = Math.max(0, estoque - ajusteReserva);
  if (s <= 0) return "zero";
  if (s < 50) return "baixo";
  if (s < 200) return "medio";
  return "alto";
}
