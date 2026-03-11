import { Link } from "react-router-dom";
import { calcularPreco, formatarBRL } from "@/utils/price";
import { Skeleton } from "@/components/ui/skeleton";

interface ProductCardProps {
  nome: string;
  slug: string | null;
  image_url: string | null;
  cor: string | null;
  preco_custo: number | null;
  codigo_amigavel: string;
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

const ProductCard = ({ nome, slug, image_url, cor, preco_custo, codigo_amigavel }: ProductCardProps) => {
  const precoMin = preco_custo ? calcularPreco(preco_custo, 1000) : null;
  const preco20 = preco_custo ? calcularPreco(preco_custo, 20) : null;
  const href = slug ? `/produto/${slug}` : `/produto/${codigo_amigavel}`;

  return (
    <Link
      to={href}
      className="rounded-[16px] bg-card border border-border overflow-hidden group transition-all duration-250 hover:-translate-y-1 hover:border-green-cta block"
      style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.4)" }}
    >
      <div className="relative aspect-square bg-secondary overflow-hidden">
        {image_url ? (
          <img
            src={image_url}
            alt={nome}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-muted-foreground text-sm">Sem imagem</span>
          </div>
        )}
      </div>
      <div className="p-4 flex flex-col gap-1.5">
        <h4 className="font-bold text-foreground text-[15px] leading-tight line-clamp-2">{nome}</h4>
        {cor && <span className="text-[13px] text-muted-foreground">Cor: {cor}</span>}
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
        <div className="mt-2 w-full rounded-[10px] bg-green-cta text-primary-foreground py-2 text-sm font-bold text-center hover:brightness-110 transition-all duration-200">
          Ver Produto
        </div>
      </div>
    </Link>
  );
};

export default ProductCard;
