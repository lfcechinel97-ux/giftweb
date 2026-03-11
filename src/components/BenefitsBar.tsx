import { useState, useEffect, useCallback } from "react";
import { CreditCard, QrCode, ShieldCheck, Truck, Award } from "lucide-react";

const items = [
  { icon: CreditCard, title: "Pague em até 10x", subtitle: "no cartão" },
  { icon: QrCode, title: "Descontos especiais", subtitle: "pagando no Pix" },
  { icon: ShieldCheck, title: "Compra 100% segura", subtitle: "e confiável" },
  { icon: Truck, title: "Entrega para todo Brasil", subtitle: "rápida e rastreável" },
  { icon: Award, title: "+15 anos de mercado", subtitle: "experiência garantida" },
];

const BenefitsBar = () => {
  const [current, setCurrent] = useState(0);

  const next = useCallback(() => {
    setCurrent((prev) => (prev + 1) % Math.ceil(items.length / 2));
  }, []);

  useEffect(() => {
    const interval = setInterval(next, 4000);
    return () => clearInterval(interval);
  }, [next]);

  const totalPages = Math.ceil(items.length / 2);

  return (
    <section className="bg-surface-alt border-t border-b border-border" style={{ padding: "28px 0" }}>
      <div className="container">
        {/* Desktop: 5 columns */}
        <div className="hidden lg:grid grid-cols-5 gap-4">
          {items.map(({ icon: Icon, title, subtitle }) => (
            <div key={title} className="flex flex-col items-center gap-1.5 text-center">
              <Icon size={28} className="text-green-teal" strokeWidth={1.5} />
              <span className="text-[15px] font-bold text-foreground">{title}</span>
              <span className="text-[13px] text-muted-foreground">{subtitle}</span>
            </div>
          ))}
        </div>

        {/* Mobile: carousel 2 per view */}
        <div className="lg:hidden overflow-hidden">
          <div
            className="flex transition-transform duration-500 ease-in-out"
            style={{ transform: `translateX(-${current * 100}%)` }}
          >
            {Array.from({ length: totalPages }).map((_, pageIdx) => (
              <div key={pageIdx} className="min-w-full flex justify-center gap-8">
                {items.slice(pageIdx * 2, pageIdx * 2 + 2).map(({ icon: Icon, title, subtitle }) => (
                  <div key={title} className="flex flex-col items-center gap-1.5 text-center flex-1 max-w-[160px]">
                    <Icon size={28} className="text-green-teal" strokeWidth={1.5} />
                    <span className="text-[15px] font-bold text-foreground">{title}</span>
                    <span className="text-[13px] text-muted-foreground">{subtitle}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          {/* Dots */}
          <div className="flex justify-center gap-2 mt-4">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`w-2.5 h-2.5 rounded-full transition-all duration-200 ${
                  i === current ? "bg-green-cta w-5" : "bg-border"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default BenefitsBar;
