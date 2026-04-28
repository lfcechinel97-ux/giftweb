import { useQuery } from "@tanstack/react-query";
import { useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type SistemaProduct = Tables<"products_cache">;

const SELECT_COLS =
  "id,nome,slug,codigo_amigavel,codigo_prefixo,image_url,image_urls,preco_custo,estoque,estoque_total,categoria,tabela_precos,variantes,variantes_count,is_variante,is_hidden,produto_pai,ativo,has_image,cor,altura,largura";

const CHUNK = 1000;
const MAX_TOTAL = 20000;

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
  /** Apenas produtos pai (is_variante = false) */
  parentProducts: SistemaProduct[];
  /** Apenas variantes (is_variante = true) */
  variants: SistemaProduct[];
  isLoading: boolean;
  error: Error | null;
  /** Busca pais por texto (codigo_amigavel ou nome) — retorna até 30 */
  searchParents: (term: string) => SistemaProduct[];
  /** Busca produto+variantes pelo codigo_amigavel do pai */
  getParentWithVariants: (codigoAmigavel: string) => { parent: SistemaProduct; variants: SistemaProduct[] } | null;
  /** Dado um codigoComposto (ex: "08338-BCO"), separa pai e variante */
  resolveCodigoComposto: (codigo: string) => { parent: SistemaProduct | null; variant: SistemaProduct | null };
}

export function useSistemaProducts(): SistemaProductsResult {
  const { data = [], isLoading, error } = useQuery<SistemaProduct[]>({
    queryKey: ["sistema", "all-products"],
    queryFn: fetchAllProducts,
    staleTime: 5 * 60 * 1000,
  });

  const allProducts = data;

  const parentProducts = useMemo(
    () => allProducts.filter(p => !p.is_variante),
    [allProducts]
  );

  const variants = useMemo(
    () => allProducts.filter(p => p.is_variante),
    [allProducts]
  );

  const searchParents = useCallback(
    (term: string): SistemaProduct[] => {
      const t = term.trim().toLowerCase();
      if (!t) return parentProducts.slice(0, 30);
      return parentProducts
        .filter(
          p =>
            p.nome.toLowerCase().includes(t) ||
            p.codigo_amigavel.toLowerCase().includes(t)
        )
        .slice(0, 30);
    },
    [parentProducts]
  );

  const getParentWithVariants = useCallback(
    (codigoAmigavel: string): { parent: SistemaProduct; variants: SistemaProduct[] } | null => {
      const parent = parentProducts.find(
        p => p.codigo_amigavel === codigoAmigavel || p.id === codigoAmigavel
      );
      if (!parent) return null;
      const pvars = variants.filter(v => v.produto_pai === parent.id);
      return { parent, variants: pvars };
    },
    [parentProducts, variants]
  );

  /** Resolve "08338-BCO" → busca produto com codigo_amigavel exato, ou
   *  tenta separar prefixo+sufixo para encontrar pai e variante. */
  const resolveCodigoComposto = useCallback(
    (codigo: string): { parent: SistemaProduct | null; variant: SistemaProduct | null } => {
      const upper = codigo.toUpperCase().trim();

      // 1. Correspondência exata em qualquer produto
      const exact = allProducts.find(p => p.codigo_amigavel.toUpperCase() === upper);
      if (exact) {
        if (exact.is_variante) {
          const parent = allProducts.find(p => p.id === exact.produto_pai) ?? null;
          return { parent, variant: exact };
        }
        return { parent: exact, variant: null };
      }

      // 2. Tenta "PREFIXO-SUFIXO": pega tudo antes do último "-" como código pai
      const lastDash = upper.lastIndexOf("-");
      if (lastDash > 0) {
        const prefixo = upper.slice(0, lastDash);
        const sufixo = upper.slice(lastDash + 1);
        const parent = allProducts.find(
          p => !p.is_variante && p.codigo_amigavel.toUpperCase() === prefixo
        );
        if (parent) {
          const variant =
            allProducts.find(
              v => v.is_variante && v.produto_pai === parent.id &&
                (v.cor?.toUpperCase() === sufixo || v.codigo_amigavel.toUpperCase() === upper)
            ) ?? null;
          return { parent, variant };
        }
      }

      return { parent: null, variant: null };
    },
    [allProducts]
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
    .eq("is_variante", false)
    .order("codigo_amigavel", { ascending: true })
    .limit(limit);
  if (t) query = query.or(`nome.ilike.%${t}%,codigo_amigavel.ilike.%${t}%`);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as SistemaProduct[];
}

export async function fetchProductById(id: string): Promise<SistemaProduct | null> {
  const { data, error } = await supabase
    .from("products_cache")
    .select(SELECT_COLS)
    .eq("id", id)
    .single();
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
