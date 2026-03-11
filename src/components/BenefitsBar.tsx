import { useState, useEffect, useCallback, useRef, TouchEvent } from "react";
import { CreditCard, Truck, ShieldCheck, Award } from "lucide-react";

const items = [
  { icon: CreditCard, title: "Pague em até 10x", subtitle: "Pagamento Seguro 🔐" },
  { icon: Truck, title: "Logística FULL", subtitle: "Entrega em até 24h⚡" },
  { icon: ShieldCheck, title: "Nota Fiscal e Garantia", subtitle: "Compra Segura✅" },
  { icon: Truck, title: "Entrega para todo Brasil", subtitle: "Rápida e Rastreável📡" },
  { icon: Award, title: "+5 anos de mercado", subtitle: "Expertise no assunto🌟" },
];

const BenefitsBar = () => {
  const [current, setCurrent] = useState(0);
  const touchStart = useRef(0);

  const totalPages = Math.ceil(items.length / 2);

  const next = useCallback(() => {
    setCurrent((prev) => (prev + 1) % totalPages);
  }, [totalPages]);

  useEffect(() => {
    const interval = setInterval(next, 6000);
    return () => clearInterval(interval);
  }, [next]);

  const onTouchStart = (e: TouchEvent) => { touchStart.current = e.touches[0].clientX; };
  const onTouchEnd = (e: TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStart.current;
    if (Math.abs(dx) > 50) {
      if (dx > 0) setCurrent((p) => (p - 1 + totalPages) % totalPages);
      else next();
    }
  };

  return (
    <section className="bg-surface-alt border-t border-b border-border" style={{ padding: "28px 0" }}>
      <div className="container">
        {/* Desktop */}
        <div className="hidden lg:grid grid-cols-5 gap-4">
          {items.map(({ icon: Icon, title, subtitle }) => (
            <div key={title} className="flex flex-col items-center gap-1.5 text-center">
              <Icon size={28} className="text-green-teal" strokeWidth={1.5} />
              <span className="text-[15px] font-bold text-foreground">{title}</span>
              <span className="text-[13px] text-muted-foreground">{subtitle}</span>
            </div>
          ))}
        </div>

        {/* Mobile with swipe */}
        <div
          className="lg:hidden overflow-hidden"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div
            className="flex"
            style={{
              transform: `translateX(-${current * 100}%)`,
              transition: "transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
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
          <div className="flex justify-center gap-2 mt-4">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button key={i} onClick={() => setCurrent(i)} className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${i === current ? "bg-green-cta w-5" : "bg-border"}`} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default BenefitsBar;
