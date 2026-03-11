import { useInView } from "@/hooks/useInView";
import { ShoppingCart, CreditCard, MessageSquare, Factory, Truck, PackageCheck } from "lucide-react";

const steps = [
  {
    icon: ShoppingCart,
    title: "Escolha do produto",
    desc: "Navegue pelo catálogo e selecione o brinde desejado. Informe a quantidade e personalize com a identidade da sua empresa.",
  },
  {
    icon: CreditCard,
    title: "Definição de pagamento",
    desc: "Após escolher os produtos, defina a forma de pagamento e os dados para envio do pedido.",
  },
  {
    icon: MessageSquare,
    title: "Alinhamento da personalização",
    desc: "Nossa equipe entrará em contato rapidamente via WhatsApp ou e-mail para confirmar os detalhes da arte e da personalização.",
  },
  {
    icon: Factory,
    title: "Início da produção",
    desc: "Após a aprovação do layout virtual, iniciamos a produção dos brindes personalizados.",
  },
  {
    icon: Truck,
    title: "Despacho do pedido",
    desc: "Com a produção finalizada, seu pedido é embalado e encaminhado para envio através da transportadora.",
  },
  {
    icon: PackageCheck,
    title: "Recebimento",
    desc: "Os produtos são entregues no endereço informado no pedido. O prazo total considera produção + transporte.",
  },
];

const HowItWorks = () => {
  const { ref, inView } = useInView();

  return (
    <section className="py-10 md:py-12 bg-background">
      <div
        ref={ref}
        className={`container transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`}
      >
        <h2 className="text-center text-foreground font-extrabold text-[32px] mb-8">
          Como fazer seu <span className="text-highlight">pedido</span>
        </h2>

        {/* Desktop: horizontal */}
        <div className="hidden md:grid grid-cols-6 gap-4">
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} className="flex flex-col items-center text-center group">
                <div className="w-14 h-14 rounded-full bg-card border-2 border-border flex items-center justify-center mb-3 transition-colors group-hover:border-green-cta">
                  <Icon className="w-6 h-6 text-green-cta" />
                </div>
                <span className="text-xs font-bold text-green-cta mb-1">Passo {i + 1}</span>
                <h4 className="font-bold text-foreground text-sm mb-1">{s.title}</h4>
                <p className="text-muted-foreground text-xs leading-relaxed">{s.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Mobile: vertical */}
        <div className="flex md:hidden flex-col gap-6">
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} className="flex gap-4 items-start">
                <div className="w-12 h-12 rounded-full bg-card border-2 border-border flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-green-cta" />
                </div>
                <div>
                  <span className="text-xs font-bold text-green-cta">Passo {i + 1}</span>
                  <h4 className="font-bold text-foreground text-sm">{s.title}</h4>
                  <p className="text-muted-foreground text-xs leading-relaxed">{s.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
