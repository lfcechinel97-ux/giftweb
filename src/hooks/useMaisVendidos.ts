import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TopProduct } from "@/components/topprodutos/TopProductCard";

// Ordered list of best-sellers with search patterns (ILIKE) against products_cache.nome
const BEST_SELLERS: { label: string; patterns: string[] }[] = [
  { label: "Copo Térmico 473ml com tampa", patterns: ["%COPO TÉRMICO%473%TAMPA%", "%COPO TÉRMICO%473%"] },
  { label: "Garrafa Quencher 1,2L", patterns: ["%QUENCHER%", "%GARRAFA%1,2L%", "%GARRAFA%1200%"] },
  { label: "Copo Térmico Cuia 350ml", patterns: ["%CUIA%350%", "%COPO%CUIA%", "%CUIA%"] },
  { label: "Garrafa Led Termômetro 500ml", patterns: ["%GARRAFA%TERMÔMETRO%500%", "%GARRAFA%TERMOMETRO%500%", "%GARRAFA%TERMÔMETRO%", "%GARRAFA%TERMOMETRO%"] },
  { label: "Kit Churrasco 2 Peças", patterns: ["%KIT CHURRASCO 2 PEÇAS%", "%KIT CHURRASCO%2 PÇS%"] },
  { label: "Squeeze Alumínio 650ml", patterns: ["%SQUEEZE ALUMÍNIO 650%", "%SQUEEZE%650%"] },
  { label: "Garrafa Térmica 850ml", patterns: ["%GARRAFA TÉRMICA 850%", "%GARRAFA%850%"] },
  { label: "Mochila USB 20L", patterns: ["%MOCHILA%USB 20L%", "%MOCHILA%USB 20 %"] },
  { label: "Caderneta Moleskine CS Pauta", patterns: ["%MOLESKINE%PAUTA%", "%MOLESKINE%CS%", "%CADERNETA%MOLESKINE%", "%MOLESKINE%"] },
  { label: "Caneca Térmica Chopp 700ml", patterns: ["%CANECA%CHOPP%700%", "%CANECA TÉRMICA%700%", "%CHOPP%700%"] },
];

async function findFirst(patterns: string[], excludeIds: Set<string>): Promise<TopProduct | null> {
  for (const pattern of patterns) {
    const { data, error } = await supabase
      .from("products_cache")
      .select("id,nome,image_url,image_urls,preco_custo,codigo_amigavel")
      .eq("ativo", true)
      .eq("has_image", true)
      .eq("is_variante", false)
      .neq("is_hidden", true)
      .gt("estoque", 0)
      .ilike("nome", pattern)
      .not("image_urls", "is", null)
      .order("estoque", { ascending: false })
      .limit(10);
    if (error) continue;
    const rows = (data || []) as TopProduct[];
    // Prefer >=2 images and not already selected
    const preferred =
      rows.find((r) => !excludeIds.has(r.id) && Array.isArray(r.image_urls) && r.image_urls.length >= 2) ||
      rows.find((r) => !excludeIds.has(r.id));
    if (preferred) return preferred;
  }
  return null;
}

async function fetchMaisVendidos(): Promise<(TopProduct | null)[]> {
  const results: (TopProduct | null)[] = [];
  const usedIds = new Set<string>();
  for (const item of BEST_SELLERS) {
    const found = await findFirst(item.patterns, usedIds);
    if (found) usedIds.add(found.id);
    results.push(found);
  }
  return results;
}

export function useMaisVendidos() {
  return useQuery({
    queryKey: ["mais-vendidos-top10"],
    queryFn: fetchMaisVendidos,
    staleTime: 1000 * 60 * 5,
  });
}
