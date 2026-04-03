import { useEffect, useState } from "react";
import { useBaseCategories } from "@/hooks/useBaseCategories";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  selected: string | null;
  onSelect: (slug: string) => void;
}

const CatalogStoryCategories = ({ selected, onSelect }: Props) => {
  const { data: categories = [] } = useBaseCategories();
  const [images, setImages] = useState<Record<string, string>>({});

  // Fetch one product image per category
  useEffect(() => {
    if (categories.length === 0) return;
    const fetchImages = async () => {
      const map: Record<string, string> = {};
      await Promise.all(
        categories.map(async (cat) => {
          const { data } = await supabase
            .from("products_cache")
            .select("image_url")
            .eq("ativo", true)
            .eq("has_image", true)
            .or(`categoria.ilike.%${cat.slug}%,categoria_manual.ilike.%${cat.slug}%`)
            .limit(1)
            .single();
          if (data?.image_url) map[cat.slug] = data.image_url;
        })
      );
      setImages(map);
    };
    fetchImages();
  }, [categories]);

  if (categories.length === 0) return null;

  return (
    <div className="py-4">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
        Categorias
      </h3>
      <div className="flex overflow-x-auto gap-4 pb-2 no-scrollbar snap-x snap-mandatory">
        {/* "Todos" option */}
        <button
          onClick={() => onSelect("")}
          className="flex-shrink-0 flex flex-col items-center gap-1.5 snap-start"
        >
          <div
            className={`w-[68px] h-[68px] md:w-[76px] md:h-[76px] rounded-full flex items-center justify-center transition-all duration-200 ${
              !selected
                ? "bg-gradient-to-br from-[hsl(var(--green-cta))] to-emerald-600 p-[3px]"
                : "bg-gradient-to-br from-gray-300 to-gray-400 p-[2px]"
            }`}
          >
            <div className="w-full h-full rounded-full bg-background flex items-center justify-center">
              <span className="text-xs font-bold text-muted-foreground">TODOS</span>
            </div>
          </div>
          <span
            className={`text-[11px] leading-tight text-center max-w-[72px] truncate ${
              !selected ? "font-semibold text-foreground" : "text-muted-foreground"
            }`}
          >
            Todos
          </span>
        </button>

        {categories.map((cat) => {
          const isActive = selected === cat.slug;
          const img = images[cat.slug];
          return (
            <button
              key={cat.slug}
              onClick={() => onSelect(cat.slug)}
              className="flex-shrink-0 flex flex-col items-center gap-1.5 snap-start"
            >
              <div
                className={`w-[68px] h-[68px] md:w-[76px] md:h-[76px] rounded-full transition-all duration-200 ${
                  isActive
                    ? "bg-gradient-to-br from-[hsl(var(--green-cta))] to-emerald-600 p-[3px]"
                    : "bg-gradient-to-br from-gray-300 to-gray-400 p-[2px] hover:from-gray-400 hover:to-gray-500"
                }`}
              >
                <div className="w-full h-full rounded-full bg-background overflow-hidden">
                  {img ? (
                    <img
                      src={img}
                      alt={cat.label}
                      className="w-full h-full object-cover rounded-full"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-[10px] text-muted-foreground text-center leading-tight px-1">
                        {cat.label}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <span
                className={`text-[11px] leading-tight text-center max-w-[72px] truncate ${
                  isActive ? "font-semibold text-foreground" : "text-muted-foreground"
                }`}
              >
                {cat.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CatalogStoryCategories;
