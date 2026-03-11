import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { calcularPreco, formatarBRL } from "@/utils/price";
import { getCorHex, isLightColor } from "@/utils/colorHex";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ProductCardProps {
  id?: string;
  nome: string;
  slug: string | null;
  image_url: string | null;
  cor: string | null;
  preco_custo: number | null;
  codigo_amigavel: string;
}

interface VariantInfo {
  id: string;
  slug: string | null;
  cor: string | null;
  codigo_amigavel: string;
  image_url: string | null;
  estoque: number | null;
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

const ProductCard = ({ id, nome, slug, image_url, cor, preco_custo, codigo_amigavel }: ProductCardProps) => {
  const precoMin = preco_custo ? calcularPreco(preco_custo, 1000) : null;
  const preco20 = preco_custo ? calcularPreco(preco_custo, 20) : null;
  const href = slug ? `/produto/${slug}` : `/produto/${codigo_amigavel}`;

  const [variants, setVariants] = useState<VariantInfo[] | null>(null);
  const [hasBeenVisible, setHasBeenVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Intersection Observer: fetch variants only when visible
  useEffect(() => {
    if (!id || hasBeenVisible) return;
    const el = cardRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasBeenVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [id, hasBeenVisible]);

  // Fetch variants when visible
  useEffect(() => {
    if (!hasBeenVisible || !id) return;
    supabase
      .from("products_cache")
      .select("id,slug,cor,codigo_amigavel,image_url,estoque")
      .eq("produto_pai", id)
      .eq("ativo", true)
      .eq("has_image", true)
      .order("codigo_amigavel")
      .then(({ data }) => {
        if (data && data.length > 1) {
          setVariants(data as VariantInfo[]);
        }
      });
  }, [hasBeenVisible, id]);

  return (
    <div ref={cardRef} className="rounded-[16px] bg-card border border-border overflow-hidden group transition-all duration-250 hover:-translate-y-1 hover:border-green-cta" style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.4)" }}>
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
        </div>
      </Link>
      <div className="p-4 flex flex-col gap-1.5">
        <Link to={href}>
          <h4 className="font-bold text-foreground text-[15px] leading-tight line-clamp-2">{nome}</h4>
        </Link>

        {/* Color variants dots */}
        {variants && variants.length > 1 && (
          <TooltipProvider delayDuration={200}>
            <div className="flex items-center gap-1.5 mt-0.5">
              {variants.slice(0, MAX_DOTS).map((v) => {
                const hex = getCorHex(v.cor);
                const isCurrent = v.codigo_amigavel === codigo_amigavel;
                const needsBorder = isLightColor(hex);
                return (
                  <Tooltip key={v.id}>
                    <TooltipTrigger asChild>
                      <Link
                        to={v.slug ? `/produto/${v.slug}` : `/produto/${v.codigo_amigavel}`}
                        className="block rounded-full transition-all"
                        style={{
                          width: 14,
                          height: 14,
                          backgroundColor: hex,
                          border: needsBorder ? '1px solid hsl(var(--border))' : 'none',
                          outline: isCurrent ? '2px solid hsl(142,71%,45%)' : 'none',
                          outlineOffset: 1,
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">{v.cor || 'Cor'}</TooltipContent>
                  </Tooltip>
                );
              })}
              {variants.length > MAX_DOTS && (
                <span className="text-[11px] text-muted-foreground">+{variants.length - MAX_DOTS}</span>
              )}
              <span className="text-[12px] text-muted-foreground ml-1">{variants.length} cores</span>
            </div>
          </TooltipProvider>
        )}

        {cor && (!variants || variants.length <= 1) && (
          <span className="text-[13px] text-muted-foreground">Cor: {cor}</span>
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
