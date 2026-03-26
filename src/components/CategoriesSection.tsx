import { useState, useEffect } from "react";
import { useInView } from "@/hooks/useInView";
import { Link } from "react-router-dom";
import { useSiteContent } from "@/hooks/useSiteContent";
import { useBaseCategories } from "@/hooks/useBaseCategories";
import catGarrafas from "@/assets/cat-garrafas.webp";
import catBolsas from "@/assets/cat-bolsas.webp";
import catMochilas from "@/assets/cat-mochilas.webp";
import catKit from "@/assets/cat-kit.webp";
import catBrindes from "@/assets/cat-brindes.webp";

// Default images by slug keyword
const defaultImages: Record<string, string> = {
  garrafas: catGarrafas,
  copos: catGarrafas,
  canecas: catGarrafas,
  mochilas: catMochilas,
  bolsas: catBolsas,
  kits: catKit,
};

const topSlugs = [
  "garrafas-e-squeezes",
  "copos-e-canecas",
  "mochilas-e-sacochilas",
  "kits",
  "bolsas",
  "canetas",
  "chaveiros",
];

interface Props {
  categoryCounts: Record<string, number>;
}

const CategoriesSection = ({ categoryCounts: _categoryCounts }: Props) => {
  const { ref, inView } = useInView();
  const { rows: siteRows } = useSiteContent("categorias");
  const { data: dbCategories } = useBaseCategories();

  const legacyMap: Record<string, string> = {
    "garrafas-e-squeezes": "garrafas",
    "copos-e-canecas": "canecas",
    "mochilas-e-sacochilas": "mochilas",
    "canetas": "escritorio",
  };
  const getContentValue = (id: string) => {
    const val = siteRows.find((r) => r.id === id)?.value;
    if (val) return val;
    // Fallback to legacy key
    const slug = id.replace(/^cat_(img|link)_/, "");
    const legacySlug = legacyMap[slug];
    if (legacySlug) {
      const legacyId = id.replace(slug, legacySlug);
      return siteRows.find((r) => r.id === legacyId)?.value || null;
    }
    return null;
  };

  // Build display list: use topSlugs order, fill from DB
  const cats = topSlugs.map((slug) => {
    const dbCat = dbCategories?.find((c) => c.slug === slug);
    const label = dbCat?.label || slug;
    const customImg = getContentValue(`cat_img_${slug}`);
    const customLink = getContentValue(`cat_link_${slug}`);
    const defaultImg = Object.entries(defaultImages).find(([k]) => slug.includes(k))?.[1] || catBrindes;

    return {
      key: slug,
      name: label,
      img: customImg || defaultImg,
      route: customLink || `/categoria/${slug}`,
    };
  });

  return (
    <section className="py-10 md:py-14 bg-background">
      <div
        ref={ref}
        className={`container transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`}
      >
        <h2 className="text-center text-foreground font-extrabold text-[28px] md:text-[32px] mb-2">
          Nossas <span className="text-highlight">Categorias</span>
        </h2>
        <p className="text-center text-muted-foreground text-sm mb-8">Explore nossa linha completa de brindes corporativos</p>

        {/* Desktop: 7 columns, single row */}
        <div
          className="hidden lg:grid mx-auto"
          style={{ gridTemplateColumns: "repeat(7, 1fr)", gap: 20, maxWidth: 1200, padding: "0 32px" }}
        >
          {cats.map((cat) => (
            <Link
              key={cat.key}
              to={cat.route}
              className="flex flex-col items-center gap-3 group"
            >
              <div
                className="w-[148px] h-[148px] rounded-full overflow-hidden transition-all duration-300 group-hover:-translate-y-1.5"
                style={{
                  border: "2.5px solid hsl(var(--border))",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
                  transition: "border-color 0.25s, box-shadow 0.25s, transform 0.25s"
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "hsl(142 71% 45%)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 6px 20px rgba(34,197,94,0.18)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "hsl(var(--border))";
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 10px rgba(0,0,0,0.06)";
                }}
              >
                <img src={cat.img} alt={cat.name} loading="lazy" width={148} height={148} className="w-full h-full object-cover" draggable={false} />
              </div>
              <span className="font-semibold text-[13px] text-foreground text-center leading-snug group-hover:text-primary transition-colors duration-200">
                {cat.name}
              </span>
            </Link>
          ))}
        </div>

        {/* Mobile: 2-at-a-time carousel with autoplay */}
        <MobileCarousel cats={cats} />
      </div>
    </section>
  );
};

function MobileCarousel({ cats }: { cats: Array<{ key: string; name: string; img: string; route: string }> }) {
  const groups: Array<[typeof cats[0], typeof cats[0]]> = [];
  for (let i = 0; i < cats.length; i += 2) {
    if (i + 1 < cats.length) {
      groups.push([cats[i], cats[i + 1]]);
    } else {
      groups.push([cats[i], cats[0]]);
    }
  }
  const total = groups.length;

  const [slide, setSlide] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [direction, setDirection] = useState<"left" | "right">("left");

  const goTo = (next: number) => {
    if (animating || next === slide) return;
    setDirection(next > slide ? "left" : "right");
    setAnimating(true);
    setTimeout(() => {
      setSlide(next);
      setAnimating(false);
    }, 300);
  };

  useEffect(() => {
    const t = setInterval(() => {
      goTo((slide + 1) % total);
    }, 2500);
    return () => clearInterval(t);
  }, [slide, total, animating]);

  const current = groups[slide] ?? groups[0];

  return (
    <div className="lg:hidden overflow-hidden relative">
      <div
        className="grid grid-cols-2 gap-5 px-6"
        style={{
          opacity: animating ? 0 : 1,
          transform: animating
            ? `translateX(${direction === "left" ? "-20px" : "20px"})`
            : "translateX(0)",
          transition: "opacity 0.3s ease, transform 0.3s ease",
        }}
      >
        {current.map((cat, i) => (
          <Link
            key={`${slide}-${i}`}
            to={cat.route}
            className="flex flex-col items-center gap-2.5 no-underline"
          >
            <div
              className="w-[120px] h-[120px] rounded-full overflow-hidden border-2 border-border bg-muted"
              style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}
            >
              <img src={cat.img} alt={cat.name} loading="lazy" width={120} height={120} className="w-full h-full object-cover" draggable={false} />
            </div>
            <span className="font-semibold text-[13px] text-foreground text-center">{cat.name}</span>
          </Link>
        ))}
      </div>

      <div className="flex justify-center gap-1.5 mt-5">
        {groups.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            className="h-1.5 rounded-full transition-all duration-300"
            style={{
              width: slide === i ? 20 : 6,
              background: slide === i ? "hsl(var(--green-cta))" : "hsl(var(--muted-foreground) / 0.3)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default CategoriesSection;
