import { useEffect, useState } from "react";
import { useInView } from "@/hooks/useInView";
import { Download } from "lucide-react";
import { useSiteContentContext } from "@/contexts/SiteContentContext";
import catalogGeral from "@/assets/catalog-geral.webp";
import catalogCorporativo from "@/assets/catalog-corporativo.webp";

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
  // Use rows directly to avoid infinite loop from getBySection creating new arrays
  const [sectionTitle, setSectionTitle] = useState("");
  const [items, setItems] = useState<CatalogItem[]>(defaults);

  const { rows } = useSiteContentContext();

  useEffect(() => {
    const catalogRows = rows.filter(r => r.section === "catalogs");
    if (catalogRows.length === 0) return;
    const map: Record<string, string> = {};
    catalogRows.forEach(r => { if (r.value) map[r.id] = r.value; });

    if (map['catalog_title']) setSectionTitle(map['catalog_title']);

    const newItems: CatalogItem[] = [1, 2, 3].map(i => ({
      img: map[`catalog_${i}_img`] || defaults[i - 1]?.img || "",
      title: map[`catalog_${i}_title`] || defaults[i - 1]?.title || "",
      link: map[`catalog_${i}_link`] || defaults[i - 1]?.link || "#",
    }));
    setItems(newItems);
  }, [rows]);

  const visibleItems = items.filter(it => it.img);
  if (visibleItems.length === 0) return null;

  return (
    <section className="py-10 md:py-16 bg-background">
      <div
        ref={ref}
        className={`px-3 md:container transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`}
      >
        <div className="text-center mb-8">
          <h2 className="text-foreground font-extrabold text-[26px] md:text-[32px]">
            {sectionTitle || <>Baixe nosso <span className="text-highlight">catálogo</span></>}
          </h2>
          <p className="text-muted-foreground text-sm mt-1.5">Confira todos os produtos disponíveis para personalização</p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-5 md:gap-10">
          {visibleItems.map((cat, i) => (
            <a key={i} href={cat.link || "#"} target="_blank" rel="noopener noreferrer" className="group flex flex-col items-center w-[44vw] md:w-[260px]">
              <div
                className="w-full md:w-[260px] h-[140px] md:h-[200px] flex items-center justify-center rounded-2xl transition-all duration-300"
                style={{
                  background: "hsl(var(--secondary))",
                  border: "1.5px solid hsl(var(--border))",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.boxShadow = "0 10px 32px rgba(0,0,0,0.1)";
                  el.style.transform = "scale(1.03) translateY(-3px)";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.boxShadow = "0 2px 10px rgba(0,0,0,0.05)";
                  el.style.transform = "scale(1) translateY(0)";
                }}
              >
                <img
                  src={cat.img}
                  alt={cat.title || `Catálogo ${i + 1}`}
                  loading="lazy"
                  width={220}
                  height={170}
                  className="max-w-[85%] max-h-[85%] object-contain drop-shadow-lg"
                  style={{ transition: "transform 0.3s ease" }}
                />
              </div>
              {cat.title && (
                <div className="flex items-center gap-1.5 mt-3">
                  <Download size={12} className="text-primary flex-shrink-0" />
                  <p className="text-center text-foreground font-semibold text-xs md:text-sm whitespace-pre-line leading-tight">
                    {cat.title}
                  </p>
                </div>
              )}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CatalogSection;
