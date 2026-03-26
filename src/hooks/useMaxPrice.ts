import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPrecoMinimo } from "@/utils/price";

const DEFAULT_MAX = 1000;

function ceilTo50(n: number): number {
  return Math.ceil(n / 50) * 50;
}

export function useMaxPrice() {
  const [maxPrice, setMaxPrice] = useState(DEFAULT_MAX);

  useEffect(() => {
    supabase
      .from("products_cache")
      .select("preco_custo")
      .eq("ativo", true)
      .eq("has_image", true)
      .or("is_hidden.is.null,is_hidden.eq.false")
      .gt("preco_custo", 0)
      .order("preco_custo", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0 && data[0].preco_custo) {
          const displayPrice = getPrecoMinimo(data[0].preco_custo);
          setMaxPrice(ceilTo50(displayPrice));
        }
      });
  }, []);

  return maxPrice;
}
