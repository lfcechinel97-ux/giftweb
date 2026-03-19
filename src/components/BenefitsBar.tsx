import { useState, useEffect } from "react";
import { Zap, TrendingDown, Award, Truck, FileCheck } from "lucide-react";

const items = [
  { icon: Zap, title: "Produção em até 48h", sub: "para pedidos urgentes (sob consulta)" },
  { icon: TrendingDown, title: "Preços de atacado para empresas", sub: "mais economia no volume" },
  { icon: Award, title: "Personalização com alta precisão", sub: "acabamento profissional garantido" },
  { icon: Truck, title: "Entrega para todo o Brasil", sub: "envio rápido e rastreável" },
  { icon: FileCheck, title: "Nota fiscal e suporte comercial", sub: "compra segura para sua empresa" },
];

const mobileGroups = [
  [0, 1],
  [2, 3],
  [4, 0],
];

const BenefitsBar = () => {
  const [mobileSlide, setMobileSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setMobileSlide(prev => (prev + 1) % mobileGroups.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="bg-card border-t border-b border-border" style={{ padding: "28px 24px" }}>
      <div className="max-w-[1200px] mx-auto">
        {/* MOBILE */}
        <div className="flex flex-col items-center gap-4 lg:hidden">
          <div className="grid grid-cols-2 gap-3 w-full">
            {mobileGroups[mobileSlide].map(idx => {
              const Icon = items[idx].icon;
              return (
                <div key={`${mobileSlide}-${idx}`} className="flex flex-col items-center text-center rounded-xl border border-border bg-secondary p-4 transition-opacity duration-400">
                  <div className="text-primary mb-2">
                    <Icon size={28} strokeWidth={1.5} />
                  </div>
                  <div className="text-xs font-bold text-foreground leading-[1.3]">{items[idx].title}</div>
                  <div className="text-[10px] text-muted-foreground mt-1 leading-[1.4]">{items[idx].sub}</div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-1.5">
            {mobileGroups.map((_, i) => (
              <div
                key={i}
                onClick={() => setMobileSlide(i)}
                className={`h-1.5 rounded-full cursor-pointer transition-all duration-300 ${i === mobileSlide ? "w-5 bg-primary" : "w-1.5 bg-border"}`}
              />
            ))}
          </div>
        </div>

        {/* DESKTOP */}
        <div className="hidden lg:flex items-center justify-between">
          {items.map(({ icon: Icon, title, sub }, i) => (
            <div
              key={i}
              className={`flex items-center gap-3.5 flex-1 px-6 ${i < items.length - 1 ? "border-r border-border" : ""}`}
            >
              <div className="text-primary flex-shrink-0">
                <Icon size={36} strokeWidth={1.5} />
              </div>
              <div>
                <div className="text-[13px] font-bold text-foreground leading-[1.3]">{title}</div>
                <div className="text-[11px] text-muted-foreground mt-[3px] leading-[1.4]">{sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BenefitsBar;
