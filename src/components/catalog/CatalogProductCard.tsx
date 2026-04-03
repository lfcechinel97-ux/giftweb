import { useState, useRef, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { Plus, Minus, Check, ShoppingBag } from "lucide-react";
import { calcularPreco, formatarBRL } from "@/utils/price";
import { getCorHex, isLightColor } from "@/utils/colorHex";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuotation } from "@/contexts/QuotationContext";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Product = Tables<"products_cache">;

interface VariantJson {
  slug: string;
  cor: string;
  image: string;
  estoque: number;
  codigo_amigavel: string;
}

interface CatalogProductCardProps {
  product: Product;
}

const MAX_DOTS = 5;
const CYCLE_INTERVAL = 1500;
const FADE_DURATION = 200;

export const CatalogProductCardSkeleton = () => (
  <div className="rounded-lg border border-border bg-card overflow-hidden animate-fade-in">
    <Skeleton className="aspect-square w-full" />
    <div className="p-4 flex flex-col gap-2">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/3" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-9 w-full mt-2" />
    </div>
  </div>
);

const CatalogProductCard = ({ product }: CatalogProductCardProps) => {
  const { nome, slug, image_url, image_urls, cor, preco_custo, codigo_amigavel, variantes: rawVariantes, estoque } = product;
  const variantes = rawVariantes as unknown as VariantJson[] | null;
  const { addItem } = useQuotation();

  const [qty, setQty] = useState(20);
  const [justAdded, setJustAdded] = useState(false);

  // Image cycling
  const images = useRef<string[]>([]);
  if (images.current.length === 0 && image_url) {
    images.current = [image_url];
    if (image_urls && image_urls.length > 0) {
      image_urls.forEach(img => {
        if (img && !images.current.includes(img)) images.current.push(img);
      });
    }
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
    setFading(true);
    timerRef.current = setTimeout(() => {
      setActiveIdx(0);
      setFading(false);
    }, FADE_DURATION);
  }, [clearTimers]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  if (!image_url || image_url.includes("placehold.co")) return null;

  const precoMin = preco_custo ? calcularPreco(preco_custo, 1000) : null;
  const preco20 = preco_custo ? calcularPreco(preco_custo, 20) : null;
  const href = slug ? `/catalogo/produto/${slug}` : `/catalogo/produto/${codigo_amigavel}`;

  const hasVariants = variantes && variantes.length > 0;
  const allColorOptions = hasVariants
    ? [{ cor: cor || '', image: image_url || '' }, ...variantes.map(v => ({ cor: v.cor, image: v.image }))]
    : [];

  const displayImage = images.current[activeIdx] || image_url;

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem(
      {
        id: product.id,
        name: nome,
        image: image_url || "/placeholder-product.webp",
        price: preco_custo,
        codigo_amigavel,
      },
      qty
    );
    toast.success(`${nome} adicionado ao orçamento`, { duration: 3000 });
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 2000);
  };

  return (
    <div
      className="rounded-lg border border-border bg-card overflow-hidden group transition-colors duration-200 hover:border-green-cta animate-fade-in"
      onMouseEnter={startCycle}
      onMouseLeave={stopCycle}
    >
      <Link to={href} className="block">
        <div className="relative aspect-square bg-secondary overflow-hidden">
          <img
            src={displayImage}
            alt={nome}
            loading="lazy"
            width={400}
            height={400}
            className="w-full h-full object-cover"
            style={{
              opacity: fading ? 0 : 1,
              transition: `opacity ${FADE_DURATION}ms ease`,
            }}
          />
        </div>
      </Link>

      <div className="p-3 md:p-4 flex flex-col gap-1.5">
        <Link to={href}>
          <h4 className="font-bold text-foreground text-xs md:text-[13px] leading-tight line-clamp-2 uppercase tracking-wide">
            {nome}
          </h4>
        </Link>

        {/* Color dots */}
        {allColorOptions.length > 1 && (
          <div className="flex items-center gap-1.5 mt-0.5">
            {allColorOptions.slice(0, MAX_DOTS).map((v, i) => {
              const hex = getCorHex(v.cor);
              const needsBorder = isLightColor(hex);
              return (
                <span
                  key={i}
                  className="w-3 h-3 rounded-full"
                  style={{
                    backgroundColor: hex,
                    border: needsBorder ? '1px solid #D1D5DB' : 'none',
                  }}
                />
              );
            })}
            {allColorOptions.length > MAX_DOTS && (
              <span className="text-[10px] text-muted-foreground">+{allColorOptions.length - MAX_DOTS}</span>
            )}
          </div>
        )}

        {/* Price */}
        {precoMin != null && (
          <span className="text-green-cta font-bold text-sm">
            A partir de {formatarBRL(precoMin)}
          </span>
        )}
        {preco20 != null && (
          <span className="text-muted-foreground text-[11px]">
            20 un: {formatarBRL(preco20)} / un
          </span>
        )}

        {/* Quantity selector + Add button */}
        <div className="flex items-center gap-2 mt-2">
          <div className="flex items-center border border-border rounded-md overflow-hidden">
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setQty(q => Math.max(1, q - 10)); }}
              className="w-7 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <Minus className="w-3 h-3" />
            </button>
            <input
              type="number"
              min={1}
              value={qty}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onChange={(e) => { e.stopPropagation(); setQty(Math.max(1, Number(e.target.value))); }}
              className="w-10 h-8 text-center text-xs bg-transparent border-x border-border text-foreground focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setQty(q => q + 10); }}
              className="w-7 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          <button
            onClick={handleAdd}
            className={`flex-1 h-8 rounded-md flex items-center justify-center gap-1.5 text-xs font-semibold transition-all duration-200 ${
              justAdded
                ? "bg-green-cta text-primary-foreground"
                : "bg-green-cta/10 text-green-cta hover:bg-green-cta hover:text-primary-foreground"
            }`}
          >
            {justAdded ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Adicionado</span>
              </>
            ) : (
              <>
                <ShoppingBag className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Adicionar</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CatalogProductCard;
