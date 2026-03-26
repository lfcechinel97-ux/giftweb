import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export interface ProductCache {
  id: string;
  nome: string;
  slug: string | null;
  image_url: string | null;
  cor: string | null;
  preco_custo: number | null;
  categoria: string | null;
  estoque: number | null;
  codigo_amigavel: string;
  descricao: string | null;
  variantes?: Json | null;
  variantes_count?: number | null;
}

const FEATURED_CATEGORIES = ["garrafas-e-squeezes", "copos-e-canecas", "mochilas-e-sacochilas", "kits", "bolsas", "canetas"];

async function fetchFeaturedProducts(): Promise<ProductCache[]> {
  const results = await Promise.all(
    FEATURED_CATEGORIES.map(cat =>
      supabase
        .from("products_cache")
        .select("id,nome,slug,image_url,cor,preco_custo,categoria,estoque,codigo_amigavel,descricao,variantes,variantes_count")
        .eq("categoria", cat)
      .eq("is_variante", false)
      .eq("ativo", true)
      .eq("has_image", true)
      .neq("is_hidden", true)
      .gt("estoque", 0)
      .order("estoque", { ascending: false })
      .limit(1)
      .single()
    )
  );
  return results
    .map(r => r.data)
    .filter((p): p is NonNullable<typeof p> => p !== null) as ProductCache[];
}

async function fetchHomepageData() {
  const randomOffset = Math.floor(Math.random() * 100);

  const [maisVendidos, destaques, categorias, squeezesCount, baratosCount] = await Promise.all([
    fetchFeaturedProducts(),

    supabase
      .from("products_cache")
      .select("id,nome,slug,image_url,cor,preco_custo,categoria,estoque,codigo_amigavel,descricao")
      .eq("ativo", true)
      .eq("has_image", true)
      .eq("is_variante", false)
      .neq("is_hidden", true)
      .gt("estoque", 0)
      .order("updated_at", { ascending: false })
      .range(randomOffset, randomOffset + 7),

    supabase
      .from("products_cache")
      .select("categoria")
      .eq("ativo", true)
      .eq("has_image", true)
      .eq("is_variante", false)
      .neq("is_hidden", true)
      .gt("estoque", 0),

    supabase
      .from("products_cache")
      .select("id", { count: "exact", head: true })
      .eq("ativo", true)
      .eq("has_image", true)
      .eq("is_variante", false)
      .neq("is_hidden", true)
      .gt("estoque", 0)
      .or("nome.ilike.%SQUEEZE%,descricao.ilike.%SQUEEZE%"),

    supabase
      .from("products_cache")
      .select("id", { count: "exact", head: true })
      .eq("ativo", true)
      .eq("has_image", true)
      .eq("is_variante", false)
      .neq("is_hidden", true)
      .gt("estoque", 0)
      .lte("preco_custo", 8),
  ]);

  const catCounts: Record<string, number> = {};
  if (categorias.data) {
    for (const row of categorias.data) {
      const cat = row.categoria || "outros";
      catCounts[cat] = (catCounts[cat] || 0) + 1;
    }
  }
  catCounts["squeezes"] = squeezesCount.count || 0;
  catCounts["brindes-baratos"] = baratosCount.count || 0;

  return {
    maisVendidos: maisVendidos as ProductCache[],
    destaques: (destaques.data || []) as ProductCache[],
    categorias: catCounts,
  };
}

export function useHomepageData() {
  return useQuery({
    queryKey: ["homepage-data"],
    queryFn: fetchHomepageData,
    staleTime: 300_000,
    gcTime: 600_000,
  });
}
