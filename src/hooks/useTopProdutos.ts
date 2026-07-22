import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TopProduct } from "@/components/topprodutos/TopProductCard";

async function fetchTopProdutos(limit = 3): Promise<TopProduct[]> {
  const { data, error } = await supabase
    .from("products_cache")
    .select("id,nome,image_url,image_urls,preco_custo,codigo_amigavel")
    .eq("ativo", true)
    .eq("has_image", true)
    .eq("is_variante", false)
    .neq("is_hidden", true)
    .gt("estoque", 0)
    .not("image_urls", "is", null)
    .order("estoque", { ascending: false })
    .limit(limit * 4);

  if (error) throw error;

  // Prefer products that actually have >= 2 images so hover swap works
  const withTwo = (data || []).filter(
    (p) => Array.isArray(p.image_urls) && p.image_urls.length >= 2
  );
  const pool = withTwo.length >= limit ? withTwo : data || [];
  return pool.slice(0, limit) as TopProduct[];
}

export function useTopProdutos(limit = 3) {
  return useQuery({
    queryKey: ["top-produtos", limit],
    queryFn: () => fetchTopProdutos(limit),
    staleTime: 1000 * 60 * 5,
  });
}
