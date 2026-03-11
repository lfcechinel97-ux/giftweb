import { Factory, Paintbrush, MessageCircle, Truck } from "lucide-react";

const trustCards = [
  {
    icon: Factory,
    title: "Produção própria",
    description: "Controle total da qualidade e da personalização dos brindes.",
  },
  {
    icon: Paintbrush,
    title: "Personalização profissional",
    description: "Gravação e acabamento com padrão profissional para sua marca.",
  },
  {
    icon: MessageCircle,
    title: "Atendimento rápido via WhatsApp",
    description: "Nossa equipe responde rapidamente para tirar dúvidas e agilizar seu pedido.",
  },
  {
    icon: Truck,
    title: "Envio para todo o Brasil",
    description: "Logística eficiente com entregas para empresas em todo o país.",
  },
];

const TrustSection = () => (
  <section className="py-10 bg-surface-alt border-t border-border">
    <div className="container">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {trustCards.map((card, i) => (
          <div
            key={i}
            className="flex flex-col items-center text-center rounded-[14px] bg-card border border-border p-6 transition-all duration-300 hover:border-green-cta hover:shadow-[0_0_20px_rgba(34,197,94,0.08)]"
          >
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <card.icon size={22} className="text-primary" />
            </div>
            <h4 className="font-bold text-foreground text-sm mb-1">{card.title}</h4>
            <p className="text-muted-foreground text-xs leading-relaxed">{card.description}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default TrustSection;
