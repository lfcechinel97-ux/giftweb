import { useRef, useState, useEffect, useCallback } from "react";
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

  // Build lookup from site_content
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
    <section className="py-10 md:py-12 bg-background">
      <div
        ref={ref}
        className={`container transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`}
      >
        <h2 className="text-center text-foreground font-extrabold text-[32px] mb-8">
          Nossas <span className="text-highlight">Categorias</span>
        </h2>

        {/* Desktop: static grid */}
        <div className="hidden lg:grid gap-6 mx-auto" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", maxWidth: 1200, padding: "0 48px" }}>
          {cats.map((cat) => (
            <Link
              key={cat.key}
              to={cat.route}
              className="flex flex-col items-center gap-3 group transition-transform duration-200 hover:-translate-y-1"
            >
              <div className="w-[140px] h-[140px] rounded-full bg-muted border-2 border-muted overflow-hidden transition-colors duration-200 group-hover:border-green-cta">
                <img src={cat.img} alt={cat.name} className="w-full h-full object-cover" draggable={false} />
              </div>
              <span className="font-semibold text-[13px] text-foreground text-center">{cat.name}</span>
            </Link>
          ))}
        </div>

        {/* Mobile: carousel */}
        <MobileCarousel cats={cats} />
      </div>
    </section>
  );
};

/* ── Mobile carousel (preserved swipe behavior) ── */
function MobileCarousel({ cats }: { cats: Array<{ key: string; name: string; img: string; route: string }> }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, scrollLeft: 0, time: 0 });
  const animRef = useRef<number>(0);
  const scrollPos = useRef(0);
  const velocity = useRef(0);

  const looped = [...cats, ...cats, ...cats];

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || cats.length === 0) return;

    const baseSpeed = 0.35;
    const singleSetWidth = el.scrollWidth / 3;

    const tick = () => {
      if (!isDragging) {
        if (Math.abs(velocity.current) > 0.1) {
          scrollPos.current += velocity.current;
          velocity.current *= 0.97;
        } else if (!isPaused) {
          velocity.current = 0;
          scrollPos.current += baseSpeed;
        }
        if (scrollPos.current >= singleSetWidth * 2) scrollPos.current -= singleSetWidth;
        else if (scrollPos.current < 0) scrollPos.current += singleSetWidth;
        el.scrollLeft = scrollPos.current;
      }
      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [isPaused, isDragging, cats.length]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    setIsPaused(true);
    velocity.current = 0;
    dragStart.current = { x: e.touches[0].clientX, scrollLeft: scrollRef.current?.scrollLeft || 0, time: Date.now() };
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!scrollRef.current) return;
    const dx = e.touches[0].clientX - dragStart.current.x;
    scrollRef.current.scrollLeft = dragStart.current.scrollLeft - dx;
    scrollPos.current = scrollRef.current.scrollLeft;
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const dt = Math.max(Date.now() - dragStart.current.time, 1);
    const dx = e.changedTouches[0].clientX - dragStart.current.x;
    velocity.current = (-dx / dt) * 14;
    setIsPaused(false);
  }, []);

  return (
    <div className="lg:hidden relative">
      <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

      <div
        ref={scrollRef}
        className="overflow-hidden cursor-grab active:cursor-grabbing scrollbar-hide touch-pan-x"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div className="flex gap-10 w-max py-2">
          {looped.map((cat, i) => (
            <Link key={i} to={cat.route} className="flex flex-col items-center gap-3 group/item flex-shrink-0 select-none">
              <div className="w-[90px] h-[90px] rounded-full bg-muted border-2 border-muted flex items-center justify-center overflow-hidden transition-all duration-300 group-hover/item:border-green-cta">
                <img src={cat.img} alt={cat.name} className="w-full h-full object-cover pointer-events-none" draggable={false} />
              </div>
              <span className="font-semibold text-sm text-foreground whitespace-nowrap">{cat.name}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export default CategoriesSection;
