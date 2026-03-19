import { Zap, TrendingDown, Award, Truck, FileCheck } from "lucide-react";

const items = [
  { icon: Zap, title: "Produção em até 48h", sub: "para pedidos urgentes (sob consulta)" },
  { icon: TrendingDown, title: "Preços de atacado para empresas", sub: "mais economia no volume" },
  { icon: Award, title: "Personalização com alta precisão", sub: "acabamento profissional garantido" },
  { icon: Truck, title: "Entrega para todo o Brasil", sub: "envio rápido e rastreável" },
  { icon: FileCheck, title: "Nota fiscal e suporte comercial", sub: "compra segura para sua empresa" },
];

const BenefitsBar = () => (
  <section className="bg-card border-t border-b border-border" style={{ padding: "28px 24px" }}>
    <div className="max-w-[1200px] mx-auto flex items-center justify-between flex-wrap gap-4 md:gap-0 md:flex-nowrap">
      {items.map(({ icon: Icon, title, sub }, i) => (
        <div
          key={i}
          className={`flex items-center gap-3.5 flex-[0_0_calc(50%-8px)] md:flex-1 px-2 py-3 md:px-6 md:py-0 border-b md:border-b-0 border-border ${
            i < items.length - 1 ? "md:border-r md:border-border" : ""
          } last:border-b-0`}
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
  </section>
);

export default BenefitsBar;
