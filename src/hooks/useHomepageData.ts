import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
}

async function fetchHomepageData() {
  const randomOffset = Math.floor(Math.random() * 100);

  const [lancamentos, maisVendidos, destaques, categorias] = await Promise.all([
    supabase
      .from("products_cache")
      .select("id,nome,slug,image_url,cor,preco_custo,categoria,estoque,codigo_amigavel,descricao")
      .eq("ativo", true)
      .gt("estoque", 0)
      .order("updated_at", { ascending: false })
      .limit(8),

    supabase
      .from("products_cache")
      .select("id,nome,slug,image_url,cor,preco_custo,categoria,estoque,codigo_amigavel,descricao")
      .eq("ativo", true)
      .gt("estoque", 0)
      .order("estoque", { ascending: false })
      .limit(8),

    supabase
      .from("products_cache")
      .select("id,nome,slug,image_url,cor,preco_custo,categoria,estoque,codigo_amigavel,descricao")
      .eq("ativo", true)
      .gt("estoque", 0)
      .order("updated_at", { ascending: false })
      .range(randomOffset, randomOffset + 7),

    supabase
      .from("products_cache")
      .select("categoria")
      .eq("ativo", true)
      .gt("estoque", 0),
  ]);

  // Count by category
  const catCounts: Record<string, number> = {};
  if (categorias.data) {
    for (const row of categorias.data) {
      const cat = row.categoria || "outros";
      catCounts[cat] = (catCounts[cat] || 0) + 1;
    }
  }

  return {
    lancamentos: (lancamentos.data || []) as ProductCache[],
    maisVendidos: (maisVendidos.data || []) as ProductCache[],
    destaques: (destaques.data || []) as ProductCache[],
    categorias: catCounts,
  };
}

export function useHomepageData() {
  return useQuery({
    queryKey: ["homepage-data"],
    queryFn: fetchHomepageData,
    staleTime: 300_000, // 5 min
    gcTime: 600_000,
  });
}
