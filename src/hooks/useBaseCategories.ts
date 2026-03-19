import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useBaseCategories() {
  return useQuery({
    queryKey: ["base-categories"],
    queryFn: async () => {
      const { data } = await supabase
        .from("spotlight_categories")
        .select("slug, label, position")
        .eq("category_type", "base")
        .eq("active", true)
        .order("position", { ascending: true });
      return data ?? [];
    },
    staleTime: 600_000,
  });
}
