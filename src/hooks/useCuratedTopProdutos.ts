import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { TopProduct } from "@/components/topprodutos/TopProductCard";

export type DestaqueLevel = "padrao" | "medio" | "grande";

export interface CuratedProduct extends TopProduct {
  categoria: string;
  descricao_curta: string | null;
  descricao_longa: string | null;
  mais_vendido: boolean;
  ordem: number;
  galeria: string[];
  destaque: DestaqueLevel;
  imagem_editorial: string | null;
}

export interface CategoriaMeta {
  slug: string;
  imagem_capa: string | null;
  eyebrow: string | null;
}

export const TOPPRODUTOS_CATEGORIAS: Array<{ slug: string; label: string }> = [
  { slug: "garrafas-agua", label: "Garrafas de Água" },
  { slug: "copos-cafe-cerveja", label: "Copos Café/Cerveja" },
  { slug: "guarda-chuvas", label: "Guarda-Chuvas" },
  { slug: "kit-churrasco-vinho", label: "Kit Churrasco/Vinho" },
  { slug: "som-power-bank", label: "Som e Power Bank" },
  { slug: "sacola-tnt-algodao", label: "Sacola TNT e Algodão" },
  { slug: "caderneta-caneta", label: "Caderneta + Caneta" },
  { slug: "mochilas-bolsa-necessaire", label: "Mochilas/Bolsa Térmica e Necessaire" },
];

function mapRow(r: any): CuratedProduct {
  const galeria: string[] = Array.isArray(r.galeria) ? r.galeria : [];
  const image_urls = [r.imagem_principal, r.imagem_hover, ...galeria].filter(Boolean) as string[];
  return {
    id: r.id,
    nome: r.nome,
    codigo_amigavel: r.id,
    image_url: r.imagem_principal ?? null,
    image_urls,
    preco_custo: null,
    preco_final: r.preco_exibicao != null ? Number(r.preco_exibicao) : null,
    quantidade_minima: r.moq ?? 20,
    descricao_curta: r.descricao_curta ?? null,
    descricao_longa: r.descricao_longa ?? null,
    categoria: r.categoria,
    mais_vendido: !!r.mais_vendido,
    ordem: r.ordem ?? 0,
    galeria,
    destaque: (r.destaque as DestaqueLevel) ?? "padrao",
    imagem_editorial: r.imagem_editorial ?? null,
  };
}

export function useCuratedTopProdutos() {
  return useQuery({
    queryKey: ["topprodutos-curadoria"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("topprodutos_curadoria" as any)
        .select("*")
        .eq("ativo", true)
        .order("ordem", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as any[]).map(mapRow);
    },
    staleTime: 60_000,
  });
}

export function useCategoriasMeta() {
  return useQuery({
    queryKey: ["topprodutos-categorias-meta"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("topprodutos_categorias_meta" as any)
        .select("slug, imagem_capa, eyebrow");
      if (error) throw error;
      const map = new Map<string, CategoriaMeta>();
      (data as any[]).forEach((r) => map.set(r.slug, r as CategoriaMeta));
      return map;
    },
    staleTime: 60_000,
  });
}
