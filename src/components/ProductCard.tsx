import { Link, useNavigate } from "react-router-dom";
import { calcularPreco, formatarBRL } from "@/utils/price";
import { getCorHex, isLightColor } from "@/utils/colorHex";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

interface VariantJson {
  slug: string;
  cor: string;
  image: string;
  estoque: number;
  codigo_amigavel: string;
}

interface ProductCardProps {
  id?: string;
  nome: string;
  slug: string | null;
  image_url: string | null;
  cor: string | null;
  preco_custo: number | null;
  codigo_amigavel: string;
  variantes?: VariantJson[] | null;
  estoque?: number | null;
}

export const ProductCardSkeleton = () => (
  <div className="rounded-[16px] bg-card border border-border overflow-hidden">
    <Skeleton className="aspect-square w-full" />
    <div className="p-4 flex flex-col gap-2">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/3" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-9 w-full mt-1" />
    </div>
  </div>
);

const MAX_DOTS = 4;

const ProductCard = ({ nome, slug, image_url, cor, preco_custo, codigo_amigavel, variantes, estoque }: ProductCardProps) => {
  const navigate = useNavigate();
  const precoMin = preco_custo ? calcularPreco(preco_custo, 1000) : null;
  const preco20 = preco_custo ? calcularPreco(preco_custo, 20) : null;
  const href = slug ? `/produto/${slug}` : `/produto/${codigo_amigavel}`;

  const hasVariants = variantes && variantes.length > 0;
  const allColorOptions = hasVariants
    ? [{ slug: slug || codigo_amigavel, cor: cor || '', image: image_url || '', estoque: estoque ?? 0, codigo_amigavel }, ...variantes]
    : [];
  const isOutOfStock = !hasVariants && (estoque === 0 || estoque === null);

  return (
    <div className="rounded-[16px] bg-card border border-border overflow-hidden group transition-all duration-250 hover:-translate-y-1 hover:border-green-cta" style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.4)" }}>
      <Link to={href} className="block">
        <div className="relative aspect-square bg-secondary overflow-hidden">
          {image_url ? (
            <img
              src={image_url}
              alt={nome}
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder-product.webp"; }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-muted-foreground text-sm">Sem imagem</span>
            </div>
          )}
          {isOutOfStock && (
            <Badge className="absolute top-2 left-2 bg-muted text-muted-foreground border-border text-[11px] pointer-events-none">
              Fora de Estoque
            </Badge>
          )}
        </div>
      </Link>
      <div className="p-4 flex flex-col gap-1.5">
        <Link to={href}>
          <h4 className="font-bold text-foreground text-[15px] leading-tight line-clamp-2">{nome}</h4>
        </Link>

        {/* Color variants */}
        {allColorOptions.length === 1 && (
          <span className="text-xs text-muted-foreground mt-0.5">Cor: {allColorOptions[0].cor || '—'}</span>
        )}
        {allColorOptions.length > 1 && (
          <TooltipProvider delayDuration={200}>
            <div className="flex items-center mt-0.5" style={{ gap: 6 }}>
              {allColorOptions.slice(0, MAX_DOTS).map((v, i) => {
                const hex = getCorHex(v.cor);
                const needsBorder = isLightColor(hex);
                const outOfStock = v.estoque === 0 || v.estoque == null;
                return (
                  <Tooltip key={v.codigo_amigavel || i}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          navigate(v.slug ? `/produto/${v.slug}` : `/produto/${v.codigo_amigavel}`);
                        }}
                        className="relative inline-block rounded-full cursor-pointer"
                        style={{
                          width: 12,
                          height: 12,
                          backgroundColor: hex,
                          border: needsBorder ? '1px solid hsl(var(--border))' : 'none',
                        }}
                      >
                        {outOfStock && (
                          <X className="absolute -top-0.5 -right-0.5 text-destructive" style={{ width: 10, height: 10, strokeWidth: 3 }} />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      {v.cor || 'Cor'}{outOfStock ? ' (sem estoque)' : ''}
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


        {precoMin != null && (
          <span className="text-green-cta font-bold text-sm">
            A partir de {formatarBRL(precoMin)}
          </span>
        )}
        {preco20 != null && (
          <span className="text-muted-foreground text-xs">
            20 un: {formatarBRL(preco20)} / un
          </span>
        )}
        <Link
          to={href}
          className="mt-2 w-full rounded-[10px] bg-green-cta text-primary-foreground py-2 text-sm font-bold text-center hover:brightness-110 transition-all duration-200 block"
        >
          Ver Produto
        </Link>
      </div>
    </div>
  );
};

export default ProductCard;
