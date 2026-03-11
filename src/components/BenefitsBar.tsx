import { CreditCard, QrCode, ShieldCheck, Truck, Award } from "lucide-react";

const items = [
  { icon: CreditCard, title: "Pague em até 10x", subtitle: "no cartão" },
  { icon: QrCode, title: "Descontos especiais", subtitle: "pagando no Pix" },
  { icon: ShieldCheck, title: "Compra 100% segura", subtitle: "e confiável" },
  { icon: Truck, title: "Entrega para todo Brasil", subtitle: "rápida e rastreável" },
  { icon: Award, title: "+15 anos de mercado", subtitle: "experiência garantida" },
];

const BenefitsBar = () => (
  <section className="bg-card border-t border-b border-border" style={{ padding: "28px 0" }}>
    <div className="container">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {items.map(({ icon: Icon, title, subtitle }) => (
          <div
            key={title}
            className="flex flex-col items-center gap-1.5 text-center"
          >
            <Icon size={28} className="text-green-cta" strokeWidth={1.5} />
            <span className="text-[15px] font-bold text-navy">{title}</span>
            <span className="text-[13px] text-muted-foreground">{subtitle}</span>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default BenefitsBar;
