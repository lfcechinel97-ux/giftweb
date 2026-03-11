import { useRef, useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useInView } from "@/hooks/useInView";
import catGarrafas from "@/assets/cat-garrafas.png";
import catBolsas from "@/assets/cat-bolsas.png";
import catMochilas from "@/assets/cat-mochilas.png";
import catKit from "@/assets/cat-kit.png";
import catBrindes from "@/assets/cat-brindes.png";

const cats = [
  { img: catGarrafas, name: "Garrafas e Copos" },
  { img: catBolsas, name: "Bolsas Térmicas" },
  { img: catMochilas, name: "Mochilas" },
  { img: catKit, name: "Kit Corporativo" },
  { img: catBrindes, name: "Brindes Baratos" },
];

const looped = [...cats, ...cats, ...cats];

const CategoriesSection = () => {
  const { ref, inView } = useInView();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, scrollLeft: 0, time: 0 });
  const animRef = useRef<number>(0);
  const scrollPos = useRef(0);
  const velocity = useRef(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const baseSpeed = 0.35;
    const singleSetWidth = el.scrollWidth / 3;

    const tick = () => {
      if (!isDragging) {
        // Apply velocity decay when user just released
        if (Math.abs(velocity.current) > 0.1) {
          scrollPos.current += velocity.current;
          velocity.current *= 0.97; // smooth deceleration
        } else if (!isPaused) {
          velocity.current = 0;
          scrollPos.current += baseSpeed;
        }

        // Infinite loop reset
        if (scrollPos.current >= singleSetWidth * 2) {
          scrollPos.current -= singleSetWidth;
        } else if (scrollPos.current < 0) {
          scrollPos.current += singleSetWidth;
        }
        el.scrollLeft = scrollPos.current;
      }
      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [isPaused, isDragging]);

  // Mouse drag
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    velocity.current = 0;
    dragStart.current = { x: e.clientX, scrollLeft: scrollRef.current?.scrollLeft || 0, time: Date.now() };
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    const dx = e.clientX - dragStart.current.x;
    scrollRef.current.scrollLeft = dragStart.current.scrollLeft - dx;
    scrollPos.current = scrollRef.current.scrollLeft;
  }, [isDragging]);

  const onMouseUp = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    const dt = Math.max(Date.now() - dragStart.current.time, 1);
    const dx = e.clientX - dragStart.current.x;
    velocity.current = (-dx / dt) * 12; // flick velocity
    setIsDragging(false);
  }, [isDragging]);

  // Touch drag with velocity
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    setIsPaused(true);
    velocity.current = 0;
    dragStart.current = {
      x: e.touches[0].clientX,
      scrollLeft: scrollRef.current?.scrollLeft || 0,
      time: Date.now(),
    };
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!scrollRef.current) return;
    const dx = e.touches[0].clientX - dragStart.current.x;
    scrollRef.current.scrollLeft = dragStart.current.scrollLeft - dx;
    scrollPos.current = scrollRef.current.scrollLeft;
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    const dt = Math.max(Date.now() - dragStart.current.time, 1);
    const lastTouch = e.changedTouches[0];
    const dx = lastTouch.clientX - dragStart.current.x;
    velocity.current = (-dx / dt) * 14;
    setIsPaused(false);
  }, []);

  const scroll = (dir: number) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir * 150, behavior: "smooth" });
    scrollPos.current = scrollRef.current.scrollLeft + dir * 150;
  };

  return (
    <section className="py-10 md:py-12 bg-background">
      <div
        ref={ref}
        className={`container transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`}
      >
        <h2 className="text-center text-foreground font-extrabold text-[32px] mb-8">
          Nossas <span className="text-highlight">Categorias</span>
        </h2>

        <div className="relative group">
          <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
          <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

          <button
            onClick={() => scroll(-1)}
            className="hidden md:flex absolute -left-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-card border border-border items-center justify-center text-foreground hover:border-green-cta transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => scroll(1)}
            className="hidden md:flex absolute -right-2 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-card border border-border items-center justify-center text-foreground hover:border-green-cta transition-colors"
          >
            <ChevronRight size={18} />
          </button>

          <div
            ref={scrollRef}
            className="overflow-hidden cursor-grab active:cursor-grabbing scrollbar-hide touch-pan-x"
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={() => { setIsPaused(false); setIsDragging(false); }}
            onMouseEnter={() => setIsPaused(true)}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <div className="flex gap-10 w-max py-2">
              {looped.map(({ img, name }, i) => (
                <button key={i} className="flex flex-col items-center gap-3 group/item flex-shrink-0 select-none">
                  <div className="w-[90px] h-[90px] rounded-full bg-card border-2 border-border flex items-center justify-center overflow-hidden transition-all duration-300 group-hover/item:border-green-cta group-hover/item:shadow-[0_0_20px_rgba(34,197,94,0.2)]">
                    <img src={img} alt={name} className="w-full h-full object-cover pointer-events-none" draggable={false} />
                  </div>
                  <span className="font-bold text-sm text-foreground whitespace-nowrap">{name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CategoriesSection;
