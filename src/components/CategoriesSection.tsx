import { useState, useEffect } from "react";
import { useInView } from "@/hooks/useInView";
import { Link } from "react-router-dom";
import { useSiteContent } from "@/hooks/useSiteContent";
import catGarrafas from "@/assets/cat-garrafas.png";
import catBolsas from "@/assets/cat-bolsas.png";
import catMochilas from "@/assets/cat-mochilas.png";
import catKit from "@/assets/cat-kit.png";
import catBrindes from "@/assets/cat-brindes.png";

const orderedCategories = [
  { key: "garrafas", name: "Garrafas Térmicas", img: catGarrafas, route: "/garrafas" },
  { key: "canecas", name: "Copos e Canecas", img: catGarrafas, route: "/copos" },
  { key: "mochilas", name: "Mochilas", img: catMochilas, route: "/mochilas" },
  { key: "kits", name: "Kits Corporativos", img: catKit, route: "/kits" },
  { key: "bolsas", name: "Bolsas e Sacolas", img: catBolsas, route: "/bolsas" },
  { key: "escritorio", name: "Material de Escritório", img: catBrindes, route: "/escritorio" },
  { key: "squeezes", name: "Squeezes", img: catGarrafas, route: "/squeezes" },
];

interface Props {
  categoryCounts: Record<string, number>;
}

const CategoriesSection = ({ categoryCounts: _categoryCounts }: Props) => {
  const { ref, inView } = useInView();
  const { rows: siteRows } = useSiteContent("categorias");

  const getContentValue = (id: string) => siteRows.find((r) => r.id === id)?.value || null;

  const cats = orderedCategories.map((c) => {
    const customImg = getContentValue(`cat_img_${c.key}`);
    const customLink = getContentValue(`cat_link_${c.key}`);
    return {
      ...c,
      img: customImg || c.img,
      route: customLink || c.route,
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
                  boxShadow: "0 2px 10px hsl(200 57% 27% / 0.06)",
                  transition: "border-color 0.25s, box-shadow 0.25s, transform 0.25s"
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "hsl(82 84% 55%)";
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 6px 20px rgba(163,230,53,0.18)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = "hsl(var(--border))";
                  (e.currentTarget as HTMLElement).style.boxShadow = "0 2px 10px hsl(200 57% 27% / 0.06)";
                }}
              >
                <img src={cat.img} alt={cat.name} className="w-full h-full object-cover" draggable={false} />
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
              style={{ boxShadow: "0 2px 8px hsl(200 57% 27% / 0.06)" }}
            >
              <img src={cat.img} alt={cat.name} className="w-full h-full object-cover" draggable={false} />
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
