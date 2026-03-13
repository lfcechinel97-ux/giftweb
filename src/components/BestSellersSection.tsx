import { useState } from "react";
import { useInView } from "@/hooks/useInView";
import { calcularPreco, formatarBRL } from "@/utils/price";
import { getCorHex, isLightColor } from "@/utils/colorHex";
import { ProductCache } from "@/hooks/useHomepageData";
import { Link, useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  products: ProductCache[];
  loading?: boolean;
}

interface VariantJson {
  slug: string;
  cor: string;
  image: string;
  estoque: number;
  codigo_amigavel: string;
}

const MAX_DOTS = 6;

const BestSellerCard = ({ p }: { p: ProductCache }) => {
  const navigate = useNavigate();
  const [imagemAtiva, setImagemAtiva] = useState(p.image_url);
  const precoMin = p.preco_custo ? calcularPreco(p.preco_custo, 1000) : null;
  const href = p.slug ? `/produto/${p.slug}` : `/produto/${p.codigo_amigavel}`;

  const variantes = (Array.isArray(p.variantes) ? p.variantes : []) as VariantJson[];
  const allColorOptions: VariantJson[] = variantes.length > 0
    ? [{ slug: p.slug || p.codigo_amigavel, cor: p.cor || '', image: p.image_url || '', estoque: p.estoque ?? 0, codigo_amigavel: p.codigo_amigavel }, ...variantes]
    : [];

  return (
    <Link
      to={href}
      className="rounded-[16px] bg-card border border-border p-3 transition-all duration-250 group hover:-translate-y-1 hover:border-green-cta hover:shadow-[0_8px_40px_rgba(34,197,94,0.12)] cursor-pointer block"
      onMouseLeave={() => setImagemAtiva(p.image_url)}
    >
      <div className="aspect-square rounded-xl bg-secondary overflow-hidden mb-3 relative">
        <span className="absolute top-3 left-3 rounded-md bg-orange-500 px-2 py-0.5 text-xs font-bold text-white uppercase z-10">
          Mais vendido
        </span>
        {imagemAtiva ? (
          <img
            src={imagemAtiva}
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

      {/* Color dots */}
      {allColorOptions.length > 1 && (
        <TooltipProvider delayDuration={200}>
          <div className="flex items-center mt-1 mb-1" style={{ gap: 8 }}>
            {allColorOptions.slice(0, MAX_DOTS).map((v, i) => {
              const hex = getCorHex(v.cor);
              const needsBorder = isLightColor(hex);
              return (
                <Tooltip key={v.codigo_amigavel || i}>
                  <TooltipTrigger asChild>
                    <span
                      onMouseEnter={(e) => { e.preventDefault(); setImagemAtiva(v.image || p.image_url); }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        navigate(v.slug ? `/produto/${v.slug}` : `/produto/${v.codigo_amigavel}`);
                      }}
                      className="inline-block rounded-full transition-transform duration-150 hover:scale-[1.15]"
                      style={{
                        width: 16,
                        height: 16,
                        backgroundColor: hex,
                        border: needsBorder ? '1px solid #9CA3AF' : 'none',
                        cursor: 'pointer',
                      }}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    {v.cor || 'Cor'}
                  </TooltipContent>
                </Tooltip>
              );
            })}
            {allColorOptions.length > MAX_DOTS && (
              <span className="text-[11px] text-muted-foreground">+{allColorOptions.length - MAX_DOTS}</span>
            )}
          </div>
        </TooltipProvider>
      )}

      <p className="text-muted-foreground text-xs mb-0.5">A partir de</p>
      {precoMin != null && (
        <p className="text-green-cta font-extrabold text-lg">
          {formatarBRL(precoMin)}{" "}
          <span className="text-xs font-medium text-muted-foreground">no PIX</span>
        </p>
      )}
    </Link>
  );
};

const BestSellersSection = ({ products, loading }: Props) => {
  const { ref, inView } = useInView();

  return (
    <section className="py-10 md:py-12 bg-surface-alt">
      <div
        ref={ref}
        className={`container transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`}
      >
        <h2 className="text-foreground font-extrabold text-[32px] mb-6">
          Brindes mais <span className="text-highlight">procurados</span> pelas empresas
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {loading
            ? Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="rounded-[16px] bg-card border border-border p-3">
                  <Skeleton className="aspect-square rounded-xl w-full mb-3" />
                  <Skeleton className="h-4 w-3/4 mb-1" />
                  <Skeleton className="h-3 w-1/3 mb-1" />
                  <Skeleton className="h-5 w-1/2" />
                </div>
              ))
            : products.map((p) => <BestSellerCard key={p.id} p={p} />)}
        </div>
      </div>
    </section>
  );
};

export default BestSellersSection;
