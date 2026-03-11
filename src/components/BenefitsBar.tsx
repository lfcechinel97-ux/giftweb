import { Factory, Headphones, Truck, BadgeDollarSign, Award } from "lucide-react";

const items = [
  { icon: Factory, label: "Produção própria" },
  { icon: Headphones, label: "Atendimento especializado" },
  { icon: Truck, label: "Entrega rápida" },
  { icon: BadgeDollarSign, label: "Melhor preço garantido" },
  { icon: Award, label: "+15 anos de exp." },
];

const BenefitsBar = () => (
  <section className="py-6">
    <div className="container">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {items.map(({ icon: Icon, label }) => (
          <div
            key={label}
            className="flex flex-col items-center gap-2 rounded-xl bg-card p-4 shadow-sm text-center"
          >
            <Icon size={28} className="text-green-cta" strokeWidth={1.5} />
            <span className="text-sm font-medium text-foreground">{label}</span>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default BenefitsBar;
