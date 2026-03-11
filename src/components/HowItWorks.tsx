import { useInView } from "@/hooks/useInView";
import { LayoutGrid, Upload, CheckCircle, Wrench, Truck } from "lucide-react";

const steps = [
  { num: "01", icon: LayoutGrid, label: "Escolha o produto" },
  { num: "02", icon: Upload, label: "Envie sua logo" },
  { num: "03", icon: CheckCircle, label: "Aprove a arte" },
  { num: "04", icon: Wrench, label: "Produção" },
  { num: "05", icon: Truck, label: "Entrega" },
];

const HowItWorks = () => {
  const { ref, inView } = useInView();

  return (
    <section className="py-16 md:py-20 bg-background">
      <div
        ref={ref}
        className={`container transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`}
      >
        <div className="text-center mb-12">
          <h2 className="text-foreground font-extrabold text-[32px]">
            Seu pedido, do início ao <span className="text-highlight italic">fim</span>
          </h2>
          <p className="text-muted-foreground text-base mt-2">Simples, rápido e sem complicação.</p>
        </div>

        {/* Desktop: horizontal */}
        <div className="hidden md:flex items-start justify-between relative">
          {/* Dashed line */}
          <div className="absolute top-[18px] left-[10%] right-[10%] border-t border-dashed border-border" />

          {steps.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.num} className="flex flex-col items-center text-center relative z-10 w-1/5">
                <Icon className="w-8 h-8 text-foreground mb-4" strokeWidth={1.5} />
                <span className="text-green-cta font-bold text-xs mb-1">{s.num}</span>
                <span className="text-foreground font-medium text-sm">{s.label}</span>
              </div>
            );
          })}
        </div>

        {/* Mobile: vertical */}
        <div className="flex md:hidden relative pl-8">
          {/* Dashed vertical line */}
          <div className="absolute left-[14px] top-0 bottom-0 border-l border-dashed border-border" />

          <div className="flex flex-col gap-8">
            {steps.map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.num} className="flex items-center gap-4 relative">
                  <div className="absolute -left-8 w-7 h-7 rounded-full bg-background flex items-center justify-center z-10">
                    <span className="text-green-cta font-bold text-[11px]">{s.num}</span>
                  </div>
                  <Icon className="w-7 h-7 text-foreground flex-shrink-0" strokeWidth={1.5} />
                  <span className="text-foreground font-medium text-sm">{s.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
