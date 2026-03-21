import { useInView } from "@/hooks/useInView";
import { calcularPreco, formatarBRL } from "@/utils/price";
import { ProductCache } from "@/hooks/useHomepageData";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  products: ProductCache[];
  loading?: boolean;
}

const LaunchSection = ({ products, loading }: Props) => {
  const { ref, inView } = useInView();

  return (
    <section className="py-10 md:py-12 bg-background">
      <div
        ref={ref}
        className={`container transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`}
      >
        <h2 className="text-foreground font-extrabold text-[32px] mb-6">
          Novos <span className="text-highlight">lançamentos</span>
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {loading
            ? Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-[16px] bg-card border border-border p-3">
                  <Skeleton className="aspect-square rounded-xl w-full mb-3" />
                  <Skeleton className="h-4 w-3/4 mb-1" />
                  <Skeleton className="h-3 w-1/3 mb-1" />
                  <Skeleton className="h-5 w-1/2" />
                </div>
              ))
            : products.map((p) => {
                const precoMin = p.preco_custo ? calcularPreco(p.preco_custo, 1000) : null;
                const href = p.slug ? `/produto/${p.slug}` : `/produto/${p.codigo_amigavel}`;
                return (
                  <Link
                    key={p.id}
                    to={href}
                    className="rounded-[16px] bg-card border border-border p-3 transition-all duration-250 group hover:-translate-y-1 hover:border-green-cta hover:shadow-[0_8px_40px_rgba(163,230,53,0.12)] cursor-pointer block"
                  >
                    <div className="aspect-square rounded-xl bg-secondary overflow-hidden mb-3 relative">
                      <span className="absolute top-3 left-3 rounded-md bg-green-cta px-2 py-0.5 text-xs font-bold text-primary-foreground uppercase z-10">
                        Lançamento
                      </span>
                      {p.image_url ? (
                        <img
                          src={p.image_url}
                          alt={p.nome}
                          loading="lazy"
                          className="w-full h-full object-contain p-2"
                          onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder-product.webp"; }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-muted-foreground text-sm">Sem imagem</span>
                        </div>
                      )}
                    </div>
                    <h4 className="font-bold text-foreground text-sm leading-tight line-clamp-2 mb-1">
                      {p.nome}
                    </h4>
                    {p.cor && <p className="text-muted-foreground text-xs mb-0.5">Cor: {p.cor}</p>}
                    <p className="text-muted-foreground text-xs mb-0.5">A partir de</p>
                    {precoMin != null && (
                      <p className="text-green-cta font-extrabold text-lg">
                        {formatarBRL(precoMin)}{" "}
                        <span className="text-xs font-medium text-muted-foreground">no PIX</span>
                      </p>
                    )}
                  </Link>
                );
              })}
        </div>
      </div>
    </section>
  );
};

export default LaunchSection;
