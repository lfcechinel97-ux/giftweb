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

  return (
    <section className="py-10 md:py-12 bg-background">
      <div
        ref={ref}
        className={`container transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`}
      >
        <h2 className="text-center text-foreground font-extrabold text-[32px] mb-8">
          Nossas <span className="text-highlight">categorias</span>
        </h2>

        {/* Desktop: auto-scroll */}
        <div className="hidden md:block overflow-hidden">
          <div className="flex gap-10 animate-scroll-categories hover:[animation-play-state:paused] w-max">
            {looped.map(({ img, name }, i) => (
              <button key={i} className="flex flex-col items-center gap-3 group flex-shrink-0">
                <div className="w-[90px] h-[90px] rounded-full bg-card border-2 border-border flex items-center justify-center overflow-hidden transition-all duration-300 group-hover:border-green-cta group-hover:shadow-[0_0_20px_rgba(34,197,94,0.2)]">
                  <img src={img} alt={name} className="w-full h-full object-cover" />
                </div>
                <span className="font-bold text-sm text-foreground whitespace-nowrap">{name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Mobile: manual snap scroll */}
        <div className="flex md:hidden gap-6 overflow-x-auto snap-x snap-mandatory pb-4 scrollbar-hide">
          {cats.map(({ img, name }) => (
            <button key={name} className="flex flex-col items-center gap-3 group flex-shrink-0 snap-center">
              <div className="w-[90px] h-[90px] rounded-full bg-card border-2 border-border flex items-center justify-center overflow-hidden transition-all duration-300 group-hover:border-green-cta group-hover:shadow-[0_0_20px_rgba(34,197,94,0.2)]">
                <img src={img} alt={name} className="w-full h-full object-cover" />
              </div>
              <span className="font-bold text-sm text-foreground whitespace-nowrap">{name}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CategoriesSection;
