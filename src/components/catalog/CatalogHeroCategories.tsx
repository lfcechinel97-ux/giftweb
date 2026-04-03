import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useBaseCategories } from "@/hooks/useBaseCategories";

interface CategoryWithImage {
  slug: string;
  label: string;
  image: string | null;
  count: number;
}

// Featured categories for the bento grid (large cards)
const FEATURED_SLUGS = [
  "garrafas-e-squeezes",
  "copos-e-canecas",
  "mochilas-e-sacochilas",
  "canetas",
  "cadernos",
];

interface Props {
  onSelectCategory: (slug: string) => void;
}

const CatalogHeroCategories = ({ onSelectCategory }: Props) => {
  const { data: categories = [] } = useBaseCategories();
  const [catData, setCatData] = useState<CategoryWithImage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (categories.length === 0) return;

    const fetchCategoryImages = async () => {
      const results: CategoryWithImage[] = [];

      for (const cat of categories) {
        // Get first product image and count for each category
        const { data, count } = await supabase
          .from("products_cache")
          .select("image_url", { count: "exact" })
          .or(`categoria.ilike.%${cat.slug}%,categoria_manual.eq.${cat.slug}`)
          .eq("ativo", true)
          .eq("has_image", true)
          .not("image_url", "is", null)
          .order("sort_estoque", { ascending: false })
          .limit(1);

        results.push({
          slug: cat.slug,
          label: cat.label,
          image: data?.[0]?.image_url || null,
          count: count || 0,
        });
      }

      setCatData(results.filter(r => r.count > 0));
      setLoading(false);
    };

    fetchCategoryImages();
  }, [categories]);

  const featured = FEATURED_SLUGS
    .map(slug => catData.find(c => c.slug === slug))
    .filter(Boolean) as CategoryWithImage[];

  const remaining = catData.filter(c => !FEATURED_SLUGS.includes(c.slug));

  const handleClick = (slug: string) => {
    onSelectCategory(slug);
    // Scroll to products grid
    const grid = document.getElementById("catalog-products");
    if (grid) grid.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (loading) {
    return (
      <section className="py-8">
        <div className="container">
          <h2 className="text-xl font-bold text-foreground mb-5">Escolha por categoria</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={`rounded-xl bg-muted animate-pulse ${i === 0 ? "md:col-span-2 md:row-span-2 aspect-[4/3]" : "aspect-[3/2]"}`} />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-8 md:py-10">
      <div className="container">
        <h2 className="text-lg md:text-xl font-bold text-foreground mb-5 tracking-tight">
          Escolha por categoria
        </h2>

        {/* Bento grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {featured.map((cat, i) => (
            <button
              key={cat.slug}
              onClick={() => handleClick(cat.slug)}
              className={`relative overflow-hidden rounded-xl group cursor-pointer transition-all duration-300 ${
                i === 0
                  ? "col-span-2 row-span-2 aspect-[4/3] md:aspect-auto"
                  : "aspect-[3/2]"
              }`}
            >
              {cat.image && (
                <img
                  src={cat.image}
                  alt={cat.label}
                  loading={i < 3 ? "eager" : "lazy"}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent group-hover:from-black/50 transition-colors duration-300" />
              <div className="absolute bottom-0 left-0 right-0 p-3 md:p-4">
                <h3 className="text-white font-bold text-sm md:text-base leading-tight drop-shadow-sm">
                  {cat.label}
                </h3>
                <span className="text-white/70 text-xs mt-0.5 block">
                  {cat.count} brindes
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Scrollable chips for remaining categories */}
        {remaining.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none -mx-1 px-1">
            {remaining.map(cat => (
              <button
                key={cat.slug}
                onClick={() => handleClick(cat.slug)}
                className="shrink-0 px-4 py-2 rounded-full border border-border bg-card text-sm text-muted-foreground hover:text-foreground hover:border-green-cta hover:bg-green-cta/5 transition-colors whitespace-nowrap"
              >
                {cat.label}
                <span className="ml-1.5 text-xs text-muted-foreground/60">{cat.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default CatalogHeroCategories;
