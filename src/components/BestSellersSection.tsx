import { useInView } from "@/hooks/useInView";
import prodSqueeze from "@/assets/prod-squeeze.png";
import prodSqueeze2 from "@/assets/prod-squeeze-2.png";
import prodEcobag from "@/assets/prod-ecobag.png";
import prodEcobag2 from "@/assets/prod-ecobag-2.png";
import prodCaderno from "@/assets/prod-caderno.png";
import prodCaderno2 from "@/assets/prod-caderno-2.png";
import prodCaneca from "@/assets/prod-caneca.png";
import prodCaneca2 from "@/assets/prod-caneca-2.png";
import prodMochila from "@/assets/prod-mochila.png";
import prodMochila2 from "@/assets/prod-mochila-2.png";
import prodKit from "@/assets/prod-kit.png";
import prodKit2 from "@/assets/prod-kit-2.png";
import prodCaneta from "@/assets/prod-caneta.png";
import prodCaneta2 from "@/assets/prod-caneta-2.png";
import prodGarrafa from "@/assets/prod-garrafa.png";
import prodGarrafa2 from "@/assets/prod-garrafa-2.png";

const products = [
  { name: "Squeeze Plástico 900ml Personalizado", img: prodSqueeze, img2: prodSqueeze2, pix: "R$ 12,90" },
  { name: "Ecobag Algodão Estampada", img: prodEcobag, img2: prodEcobag2, pix: "R$ 8,50" },
  { name: "Caderno Capa Dura 100 Folhas", img: prodCaderno, img2: prodCaderno2, pix: "R$ 18,90" },
  { name: "Caneca Cerâmica 350ml", img: prodCaneca, img2: prodCaneca2, pix: "R$ 14,90" },
  { name: "Mochila Executiva Personalizada", img: prodMochila, img2: prodMochila2, pix: "R$ 45,90" },
  { name: "Kit Escritório Premium", img: prodKit, img2: prodKit2, pix: "R$ 62,00" },
  { name: "Caneta Corporativa Metal", img: prodCaneta, img2: prodCaneta2, pix: "R$ 5,90" },
  { name: "Garrafa Térmica Inox 500ml", img: prodGarrafa, img2: prodGarrafa2, pix: "R$ 32,90" },
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

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {products.map((p, i) => (
            <a
              key={i}
              href={`/produto/${i + 1}`}
              className="rounded-[16px] bg-card border border-border p-3 transition-all duration-250 group hover:-translate-y-1 hover:border-green-cta hover:shadow-[0_8px_40px_rgba(34,197,94,0.12)] cursor-pointer block"
            >
              <div className="aspect-square rounded-xl bg-secondary overflow-hidden mb-3 relative">
                <img src={p.img} alt={p.name} className="w-full h-full object-contain p-2 transition-opacity duration-300 group-hover:opacity-0" />
                <img src={p.img2} alt={p.name} className="w-full h-full object-contain p-2 absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              </div>
              <h4 className="font-bold text-foreground text-sm leading-tight line-clamp-2 mb-1">
                {p.name}
              </h4>
              <p className="text-muted-foreground text-xs mb-0.5">A partir de</p>
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
