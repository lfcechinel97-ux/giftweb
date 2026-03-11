import { useInView } from "@/hooks/useInView";

const products = [
  { name: "Squeeze Plástico 900ml Personalizado", img: "" },
  { name: "Ecobag Algodão Estampada", img: "" },
  { name: "Caderno Capa Dura 100 Folhas", img: "" },
  { name: "Caneca Cerâmica 350ml", img: "" },
  { name: "Mochila Executiva Personalizada", img: "" },
  { name: "Kit Escritório Premium", img: "" },
];

const BestSellersSection = () => {
  const { ref, inView } = useInView();

  return (
    <section className="py-20 md:py-20 bg-surface-alt">
      <div
        ref={ref}
        className={`container transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`}
      >
        <h2 className="text-foreground font-extrabold text-[32px] mb-8">
          Mais <span className="text-highlight">vendidos</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {products.map((p, i) => (
            <div
              key={i}
              className="flex gap-4 rounded-[16px] bg-card border border-border p-4 transition-all duration-250 group hover:-translate-y-1 hover:border-green-cta hover:shadow-[0_8px_40px_rgba(34,197,94,0.12)]"
            >
              <div className="w-24 h-24 flex-shrink-0 rounded-xl bg-secondary flex items-center justify-center">
                <span className="text-muted-foreground text-xs text-center">Imagem</span>
              </div>
              <div className="flex flex-col justify-between flex-1 min-w-0">
                <h4 className="font-bold text-foreground text-base leading-tight line-clamp-2">
                  {p.name}
                </h4>
                <button className="mt-2 w-full rounded-[10px] bg-green-cta text-primary-foreground py-2.5 text-sm font-bold hover:brightness-110 transition-all duration-200 hover:shadow-[0_0_24px_rgba(34,197,94,0.4)]">
                  Solicitar orçamento
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BestSellersSection;
