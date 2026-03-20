import { useState, useRef, useCallback, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { calcularPreco, formatarBRL } from "@/utils/price";
import { getCorHex, isLightColor } from "@/utils/colorHex";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

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
  image_urls?: string[] | null;
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
    </div>
  </div>
);

const MAX_DOTS = 6;
const CYCLE_INTERVAL = 1500; // 1.5s between image switches
const FADE_DURATION = 200;   // ms for fade transition

const ProductCard = ({ nome, slug, image_url, image_urls, cor, preco_custo, codigo_amigavel, variantes, estoque }: ProductCardProps) => {
  const navigate = useNavigate();

  // Build image list once — primary image + extra image_urls + variant images
  const images = useRef<string[]>([]);
  if (images.current.length === 0 && image_url) {
    images.current = [image_url];
    // Add extra images from image_urls array
    if (image_urls && image_urls.length > 0) {
      image_urls.forEach(img => {
        if (img && !images.current.includes(img)) images.current.push(img);
      });
    }
    // Add variant images
    if (variantes && variantes.length > 0) {
      variantes.forEach(v => {
        if (v.image && !images.current.includes(v.image)) images.current.push(v.image);
      });
    }
  }

  const [activeIdx, setActiveIdx] = useState(0);
  const [fading, setFading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cycleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isHovering = useRef(false);

  const clearTimers = useCallback(() => {
    if (cycleRef.current) { clearInterval(cycleRef.current); cycleRef.current = null; }
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  }, []);

  const goToIndex = useCallback((idx: number) => {
    setFading(true);
    timerRef.current = setTimeout(() => {
      setActiveIdx(idx);
      setFading(false);
    }, FADE_DURATION);
  }, []);

  const startCycle = useCallback(() => {
    if (images.current.length <= 1) return;
    isHovering.current = true;
    let idx = 1;
    cycleRef.current = setInterval(() => {
      if (!isHovering.current) return;
      goToIndex(idx % images.current.length);
      idx++;
    }, CYCLE_INTERVAL);
  }, [goToIndex]);

  const stopCycle = useCallback(() => {
    isHovering.current = false;
    clearTimers();
    // Fade back to first image
    setFading(true);
    timerRef.current = setTimeout(() => {
      setActiveIdx(0);
      setFading(false);
    }, FADE_DURATION);
  }, [clearTimers]);

  // Cleanup on unmount
  useEffect(() => () => clearTimers(), [clearTimers]);

  if (!image_url || image_url.includes("placehold.co")) return null;

  const precoMin = preco_custo ? calcularPreco(preco_custo, 1000) : null;
  const preco20 = preco_custo ? calcularPreco(preco_custo, 20) : null;
  const href = slug ? `/produto/${slug}` : `/produto/${codigo_amigavel}`;

  const hasVariants = variantes && variantes.length > 0;
  const allColorOptions = hasVariants
    ? [{ slug: slug || codigo_amigavel, cor: cor || '', image: image_url || '', estoque: estoque ?? 0, codigo_amigavel }, ...variantes]
    : [];
  const isOutOfStock = !hasVariants && (estoque === 0 || estoque === null);

  const displayImage = images.current[activeIdx] || image_url;

  return (
    <div
      className="rounded-[16px] bg-card border border-border overflow-hidden group transition-colors duration-200 hover:border-green-cta"
      onMouseEnter={startCycle}
      onMouseLeave={stopCycle}
    >
      <Link to={href} className="block">
        <div className="relative aspect-square bg-secondary overflow-hidden">
          <img
            src={displayImage}
            alt={nome}
            loading="lazy"
            className="w-full h-full object-cover"
            style={{
              opacity: fading ? 0 : 1,
              transition: `opacity ${FADE_DURATION}ms ease`,
            }}
          />
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

        {/* Color variant dots */}
        {allColorOptions.length > 1 && (
          <TooltipProvider delayDuration={200}>
            <div className="flex items-center mt-1 gap-2">
              {allColorOptions.slice(0, MAX_DOTS).map((v, i) => {
                const hex = getCorHex(v.cor);
                const needsBorder = isLightColor(hex);
                return (
                  <Tooltip key={v.codigo_amigavel || i}>
                    <TooltipTrigger asChild>
                      <span
                        onMouseEnter={() => {
                          // pause cycle and show this variant's image
                          clearTimers();
                          isHovering.current = false;
                          const imgIdx = images.current.indexOf(v.image);
                          goToIndex(imgIdx >= 0 ? imgIdx : 0);
                        }}
                        onMouseLeave={() => {
                          // resume cycling
                          isHovering.current = true;
                          startCycle();
                        }}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          navigate(v.slug ? `/produto/${v.slug}` : `/produto/${v.codigo_amigavel}`);
                        }}
                        className="inline-block rounded-full transition-transform duration-150 hover:scale-[1.2]"
                        style={{
                          width: 14,
                          height: 14,
                          backgroundColor: hex,
                          border: needsBorder ? '1px solid #9CA3AF' : 'none',
                          cursor: 'pointer',
                          flexShrink: 0,
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
      </div>
    </div>
  );
};

export default ProductCard;
