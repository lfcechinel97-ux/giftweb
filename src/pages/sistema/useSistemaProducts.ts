import { useQuery } from "@tanstack/react-query";
import { useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type SistemaProduct = Tables<"products_cache">;

const SELECT_COLS =
  "id,nome,slug,codigo_amigavel,codigo_prefixo,image_url,image_urls,preco_custo,estoque,estoque_total,categoria,tabela_precos,variantes,variantes_count,is_variante,is_hidden,produto_pai,ativo,has_image,cor,altura,largura";

const DEFAULT_PAGE_SIZE = 80;

/** Extrai o prefixo de um código: "02087-AZU" → "02087", "02087" → "02087" */
function extractPrefixo(codigo: string): string {
  if (!codigo) return "";
  const idx = codigo.indexOf("-");
  return idx > 0 ? codigo.slice(0, idx) : codigo;
}

interface SearchResponse { rows: SistemaProduct[]; total_count: number; }

async function fetchSystemProducts(term = "", limit = DEFAULT_PAGE_SIZE): Promise<SistemaProduct[]> {
  const { data, error } = await supabase.rpc("sistema_search_products" as any, {
    p_search: term || null,
    p_page: 1,
    p_page_size: limit,
  });
  if (error) throw error;
  const result = data as SearchResponse | null;
  return (result?.rows ?? []) as SistemaProduct[];
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
  searchParents: (term: string, limit?: number) => Promise<SistemaProduct[]>;
  /** Busca produto+variantes pelo codigo_amigavel (ou prefixo) */
  getParentWithVariants: (codigoAmigavel: string) => Promise<{ parent: SistemaProduct; variants: SistemaProduct[] } | null>;
  /** Dado um codigoComposto (ex: "08338-BCO"), separa pai e variante */
  resolveCodigoComposto: (codigo: string) => Promise<{ parent: SistemaProduct | null; variant: SistemaProduct | null }>;
}

export function useSistemaProducts(): SistemaProductsResult {
  const {
    data = [],
    isLoading,
    error,
  } = useQuery<SistemaProduct[]>({
    queryKey: ["sistema", "products", "initial"],
    queryFn: () => fetchSystemProducts("", DEFAULT_PAGE_SIZE),
    staleTime: 15 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
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
  const searchParents = useCallback((term: string, limit = 60) => fetchSystemProducts(term, limit), []);

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
    async (codigoAmigavel: string): Promise<{ parent: SistemaProduct; variants: SistemaProduct[] } | null> => {
      if (!codigoAmigavel) return null;
      const { data, error } = await supabase.rpc("sistema_get_product_group" as any, { p_codigo: codigoAmigavel });
      if (error) throw error;
      const grupo = ((data ?? []) as SistemaProduct[]).filter(Boolean);
      if (grupo.length === 0) return null;
      const prefixo = extractPrefixo(codigoAmigavel);
      const parent = grupo.find((p) => !p.is_variante && extractPrefixo(p.codigo_amigavel) === prefixo) ?? grupo[0];
      return { parent, variants: grupo.filter((p) => p.id !== parent.id) };
    },
    [],
  );

  /** Resolve "08338-BCO" → busca produto com codigo_amigavel exato, ou
   *  tenta separar prefixo+sufixo para encontrar pai e variante. */
  const resolveCodigoComposto = useCallback(
    async (codigo: string): Promise<{ parent: SistemaProduct | null; variant: SistemaProduct | null }> => {
      const upper = codigo.toUpperCase().trim();

      const result = await getParentWithVariants(upper);
      if (!result) return { parent: null, variant: null };
      const variant = result.variants.find((v) => v.codigo_amigavel.toUpperCase() === upper || v.cor?.toUpperCase() === upper.split("-").pop()) ?? null;
      return { parent: result.parent, variant };
    },
    [getParentWithVariants],
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
  const { data, error } = await supabase.rpc("sistema_search_products" as any, {
    p_search: (term || "").trim() || null,
    p_page: 1,
    p_page_size: limit,
  });
  if (error) throw error;
  const result = data as SearchResponse | null;
  return (result?.rows ?? []) as SistemaProduct[];
}

export async function fetchProductGroup(codigo: string): Promise<SistemaProduct[]> {
  const { data, error } = await supabase.rpc("sistema_get_product_group" as any, { p_codigo: codigo });
  if (error) throw error;
  return ((data ?? []) as SistemaProduct[]).filter(Boolean);
}

export async function fetchProductById(id: string): Promise<SistemaProduct | null> {
  const { data, error } = await supabase.from("products_cache").select(SELECT_COLS).eq("id", id).single();
  if (error || !data) return null;
  return data as SistemaProduct;
}

export async function fetchVariantsByParentId(parentId: string): Promise<SistemaProduct[]> {
  const { data, error } = await supabase.rpc("sistema_get_product_group" as any, { p_codigo: parentId });
  if (error || !data) return [];
  const rows = data as SistemaProduct[];
  return rows.filter((p) => p.id !== parentId);
}

export function stockLevel(estoque: number, ajusteReserva = 0): "alto" | "medio" | "baixo" | "zero" {
  const s = Math.max(0, estoque - ajusteReserva);
  if (s <= 0) return "zero";
  if (s < 50) return "baixo";
  if (s < 200) return "medio";
  return "alto";
}
