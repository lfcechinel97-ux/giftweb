import { GlassWater, Thermometer, Backpack, Briefcase, Tag } from "lucide-react";
import { useInView } from "@/hooks/useInView";

const cats = [
  { icon: GlassWater, name: "Garrafas e Copos" },
  { icon: Thermometer, name: "Bolsas Térmicas" },
  { icon: Backpack, name: "Mochilas" },
  { icon: Briefcase, name: "Kit Corporativo" },
  { icon: Tag, name: "Brindes Baratos" },
];

// duplicate for seamless loop
const looped = [...cats, ...cats, ...cats];

const CategoriesSection = () => {
  const { ref, inView } = useInView();

  return (
    <section className="py-20 md:py-20 bg-background">
      <div
        ref={ref}
        className={`container transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`}
      >
        <h2 className="text-center text-foreground font-extrabold text-[32px] mb-10">
          Nossas <span className="text-highlight">categorias</span>
        </h2>

        {/* Desktop: auto-scroll */}
        <div className="hidden md:block overflow-hidden">
          <div className="flex gap-10 animate-[scroll-categories_25s_linear_infinite] hover:[animation-play-state:paused] w-max">
            {looped.map(({ icon: Icon, name }, i) => (
              <button
                key={i}
                className="flex flex-col items-center gap-3 group flex-shrink-0"
              >
                <div className="w-[90px] h-[90px] rounded-full bg-card border-2 border-border flex items-center justify-center transition-all duration-300 group-hover:border-green-cta group-hover:shadow-[0_0_20px_rgba(34,197,94,0.2)]">
                  <Icon size={32} className="text-green-teal" strokeWidth={1.5} />
                </div>
                <span className="font-bold text-sm text-foreground whitespace-nowrap">{name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Mobile: manual snap scroll */}
        <div className="flex md:hidden gap-6 overflow-x-auto snap-x snap-mandatory pb-4 scrollbar-hide">
          {cats.map(({ icon: Icon, name }) => (
            <button
              key={name}
              className="flex flex-col items-center gap-3 group flex-shrink-0 snap-center"
            >
              <div className="w-[90px] h-[90px] rounded-full bg-card border-2 border-border flex items-center justify-center transition-all duration-300 group-hover:border-green-cta group-hover:shadow-[0_0_20px_rgba(34,197,94,0.2)]">
                <Icon size={32} className="text-green-teal" strokeWidth={1.5} />
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
