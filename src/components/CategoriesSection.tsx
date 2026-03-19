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
    <section className="py-10 md:py-12 bg-background">
      <div
        ref={ref}
        className={`container transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`}
      >
        <h2 className="text-center text-foreground font-extrabold text-[32px] mb-8">
          Nossas <span className="text-highlight">Categorias</span>
        </h2>

        {/* Desktop: 7 columns, single row */}
        <div
          className="hidden lg:grid mx-auto"
          style={{ gridTemplateColumns: "repeat(7, 1fr)", gap: 16, maxWidth: 1200, padding: "0 32px" }}
        >
          {cats.map((cat) => (
            <Link
              key={cat.key}
              to={cat.route}
              className="flex flex-col items-center gap-3 group transition-transform duration-200 hover:-translate-y-1"
            >
              <div className="w-[160px] h-[160px] rounded-full bg-muted border-2 border-muted overflow-hidden transition-colors duration-200 group-hover:border-green-cta">
                <img src={cat.img} alt={cat.name} className="w-full h-full object-cover" draggable={false} />
              </div>
              <span className="font-semibold text-[13px] text-foreground text-center">{cat.name}</span>
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
  const total = Math.ceil(cats.length / 2);
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setSlide((prev) => (prev + 1) % total);
    }, 2500);
    return () => clearInterval(t);
  }, [total]);

  const visible = cats.slice(slide * 2, slide * 2 + 2);

  return (
    <div className="lg:hidden">
      <div
        className="grid grid-cols-2 gap-4 px-6 transition-opacity duration-300"
      >
        {visible.map((cat) => (
          <Link
            key={cat.key}
            to={cat.route}
            className="flex flex-col items-center gap-2.5 no-underline"
          >
            <div className="w-[120px] h-[120px] rounded-full bg-muted overflow-hidden">
              <img src={cat.img} alt={cat.name} className="w-full h-full object-cover" draggable={false} />
            </div>
            <span className="font-semibold text-[13px] text-foreground text-center">{cat.name}</span>
          </Link>
        ))}
      </div>

      {/* Indicators */}
      <div className="flex justify-center gap-1.5 mt-4">
        {Array.from({ length: total }).map((_, i) => (
          <button
            key={i}
            onClick={() => setSlide(i)}
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
