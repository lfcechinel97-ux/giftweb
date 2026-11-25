import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { precoPadrao } from "@/utils/precoVenda";

const DEFAULT_MAX = 1000;

function ceilTo50(n: number): number {
  return Math.ceil(n / 50) * 50;
}

export function useMaxPrice() {
  const { data: maxPrice } = useQuery({
    queryKey: ["catalog-max-price"],
    staleTime: 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products_cache")
        .select("preco_base")
        .eq("ativo", true)
        .eq("has_image", true)
        .or("is_hidden.is.null,is_hidden.eq.false")
        .gt("preco_base", 0)
        .order("preco_base", { ascending: false })
        .limit(1);
      if (error) throw error;
      const product = data?.[0];
      if (!product?.preco_base) return DEFAULT_MAX;
      return ceilTo50(precoPadrao(product, 1000));
    },
  });

  return maxPrice ?? DEFAULT_MAX;
}
