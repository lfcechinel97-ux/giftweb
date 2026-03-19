import { useEffect, useState } from "react";
import { useInView } from "@/hooks/useInView";
import { supabase } from "@/integrations/supabase/client";
import catalogGeral from "@/assets/catalog-geral.png";
import catalogCorporativo from "@/assets/catalog-corporativo.png";

interface CatalogItem {
  img: string;
  title: string;
  link: string;
}

const defaults: CatalogItem[] = [
  { title: "Catálogo +Vendidos\nCopos, Garrafas & Canetas", img: catalogGeral, link: "#" },
  { title: "Catálogo #BestSeller\nGeral - Bolsas&Office", img: catalogCorporativo, link: "#" },
  { title: "", img: "", link: "" },
];

const CatalogSection = () => {
  const { ref, inView } = useInView();
  const [sectionTitle, setSectionTitle] = useState("");
  const [items, setItems] = useState<CatalogItem[]>(defaults);

  useEffect(() => {
    supabase
      .from("site_content")
      .select("id, value")
      .eq("section", "catalogs")
      .then(({ data }) => {
        if (!data || data.length === 0) return;
        const map: Record<string, string> = {};
        data.forEach(r => { if (r.value) map[r.id] = r.value; });

        if (map['catalog_title']) setSectionTitle(map['catalog_title']);

        const newItems: CatalogItem[] = [1, 2, 3].map(i => ({
          img: map[`catalog_${i}_img`] || defaults[i - 1]?.img || "",
          title: map[`catalog_${i}_title`] || defaults[i - 1]?.title || "",
          link: map[`catalog_${i}_link`] || defaults[i - 1]?.link || "#",
        }));
        setItems(newItems);
      });
  }, []);

  const visibleItems = items.filter(it => it.img);

  if (visibleItems.length === 0) return null;

  return (
    <section className="py-10 md:py-14 bg-background">
      <div
        ref={ref}
        className={`container transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`}
      >
        <h2 className="text-foreground font-extrabold text-2xl md:text-[32px] text-center mb-8">
          {sectionTitle || <>Baixe nosso <span className="text-highlight">catálogo</span></>}
        </h2>

        <div
          className="flex flex-wrap items-end justify-center"
          style={{ gap: '32px' }}
        >
          {visibleItems.map((cat, i) => (
            <a
              key={i}
              href={cat.link || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col items-center transition-transform duration-200 hover:scale-[1.03]"
              style={{ width: '260px' }}
            >
              <div style={{ width: '260px', height: '190px' }} className="flex items-end justify-center">
                <img
                  src={cat.img}
                  alt={cat.title || `Catálogo ${i + 1}`}
                  className="max-w-full max-h-full object-contain drop-shadow-xl"
                />
              </div>
              {cat.title && (
                <p className="text-center text-foreground font-semibold text-sm mt-3 whitespace-pre-line leading-tight">
                  {cat.title}
                </p>
              )}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CatalogSection;
