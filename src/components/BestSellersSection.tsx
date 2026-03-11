import { useInView } from "@/hooks/useInView";
import prodSqueeze from "@/assets/prod-squeeze.png";
import prodEcobag from "@/assets/prod-ecobag.png";
import prodCaderno from "@/assets/prod-caderno.png";
import prodCaneca from "@/assets/prod-caneca.png";
import prodMochila from "@/assets/prod-mochila.png";
import prodKit from "@/assets/prod-kit.png";

const products = [
  { name: "Squeeze Plástico 900ml Personalizado", img: prodSqueeze, pix: "R$ 12,90" },
  { name: "Ecobag Algodão Estampada", img: prodEcobag, pix: "R$ 8,50" },
  { name: "Caderno Capa Dura 100 Folhas", img: prodCaderno, pix: "R$ 18,90" },
  { name: "Caneca Cerâmica 350ml", img: prodCaneca, pix: "R$ 14,90" },
  { name: "Mochila Executiva Personalizada", img: prodMochila, pix: "R$ 45,90" },
  { name: "Kit Escritório Premium", img: prodKit, pix: "R$ 62,00" },
];

const BestSellersSection = () => {
  const { ref, inView } = useInView();

  return (
    <section className="py-10 md:py-12 bg-surface-alt">
      <div
        ref={ref}
        className={`container transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`}
      >
        <h2 className="text-foreground font-extrabold text-[32px] mb-6">
          Mais <span className="text-highlight">vendidos</span>
        </h2>

        <div className="grid grid-cols-2 gap-4">
          {products.map((p, i) => (
            <a
              key={i}
              href={`/produto/${i + 1}`}
              className="rounded-[16px] bg-card border border-border p-3 transition-all duration-250 group hover:-translate-y-1 hover:border-green-cta hover:shadow-[0_8px_40px_rgba(34,197,94,0.12)] cursor-pointer block"
            >
              <div className="aspect-square rounded-xl bg-secondary overflow-hidden mb-3">
                <img src={p.img} alt={p.name} className="w-full h-full object-contain p-2" />
              </div>
              <h4 className="font-bold text-foreground text-sm leading-tight line-clamp-2 mb-1">
                {p.name}
              </h4>
              <p className="text-green-cta font-extrabold text-lg">
                {p.pix} <span className="text-xs font-medium text-muted-foreground">no PIX</span>
              </p>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BestSellersSection;
