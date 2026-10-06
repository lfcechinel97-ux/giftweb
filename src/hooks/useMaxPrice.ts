import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { precoPadrao } from "@/utils/precoVenda";

const DEFAULT_MAX = 1000;

function ceilTo50(n: number): number {
  return Math.ceil(n / 50) * 50;
}

export function useMaxPrice() {
  const [maxPrice, setMaxPrice] = useState(DEFAULT_MAX);

  useEffect(() => {
    supabase
      .from("products_cache")
      .select("preco_base")
      .eq("ativo", true)
      .eq("has_image", true)
      .or("is_hidden.is.null,is_hidden.eq.false")
      .gt("preco_base", 0)
      .order("preco_base", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0 && data[0].preco_base) {
          const displayPrice = precoPadrao(data[0], 1000);
          setMaxPrice(ceilTo50(displayPrice));
        }
      });
  }, []);

  return maxPrice;
}
