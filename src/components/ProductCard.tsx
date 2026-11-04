import { useState, useRef, useCallback, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { formatarBRL } from "@/utils/price";
import { linhasDePreco, precoMinimo, precoUnitario, temPreco } from "@/utils/precoVenda";
import { VOLUME_TIERS } from "@/utils/price";
import { useQuotation } from "@/contexts/QuotationContext";
import { toast } from "sonner";
import { Minus, Plus, Check } from "lucide-react";
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
  preco_base: number | null;
  preco_faixas?: unknown;
  codigo_amigavel: string;
  /** Código do produto sem a cor (products_cache.codigo_prefixo). */
  codigo_prefixo?: string | null;
  variantes?: VariantJson[] | null;
  estoque?: number | null;
  estoque_total?: number | null;
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

const QTD_MINIMA = 20;
const PASSO = 10;

const ProductCard = ({ nome, slug, image_url, image_urls, cor, preco_base, preco_faixas, codigo_amigavel, codigo_prefixo, variantes, estoque, estoque_total }: ProductCardProps) => {
  const navigate = useNavigate();
  const { addItem, setIsOpen } = useQuotation();
  const [qty, setQty] = useState(QTD_MINIMA);
  const [qtyInput, setQtyInput] = useState(String(QTD_MINIMA));
  const [justAdded, setJustAdded] = useState(false);
  const mudarQty = (n: number) => {
    const q = Math.max(QTD_MINIMA, n);
    setQty(q);
    setQtyInput(String(q));
  };

  // Determine display image: prefer an in-stock variant if the primary is out
  const primaryOutOfStock = (estoque ?? 0) === 0;
  const firstInStockVariant = variantes?.find(v => (v.estoque ?? 0) > 0);
  const preferredImage = (primaryOutOfStock && firstInStockVariant?.image) ? firstInStockVariant.image : image_url;

  // Build image list once — preferred image first, then rest
  const images = useRef<string[]>([]);
  if (images.current.length === 0 && preferredImage) {
    images.current = [preferredImage];
    if (image_url && !images.current.includes(image_url)) images.current.push(image_url);
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

  const preco = { preco_base, preco_faixas };
  const precoMin = temPreco(preco) ? precoMinimo(preco) : null;
  // As 3 primeiras faixas da tabela, para comparar o preço já na listagem
  const faixas = temPreco(preco) ? linhasDePreco(preco, VOLUME_TIERS).slice(0, 3) : [];
  let faixaAtiva = 0;
  faixas.forEach((f, i) => { if (f.qty <= qty) faixaAtiva = i; });
  const unitAtual = temPreco(preco) ? precoUnitario(preco, qty) : null;

  // Na listagem o produto vai sem cor; a cor se escolhe na página do produto
  const codigoSemCor = codigo_prefixo || codigo_amigavel;
  const handleAdd = () => {
    addItem(
      {
        id: `${codigoSemCor}::sem-cor`,
        name: nome,
        image: image_url || "/placeholder-product.webp",
        precoBase: temPreco(preco) ? preco_base : null,
        precoFaixas: preco_faixas,
        codigo_amigavel: codigoSemCor,
      },
      qty,
    );
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1500);
    toast.success(`${qty} unidades adicionadas ao carrinho`, {
      action: { label: "Ver carrinho", onClick: () => setIsOpen(true) },
      duration: 3500,
    });
  };
  const href = slug ? `/produto/${slug}` : `/produto/${codigo_amigavel}`;

  const hasVariants = variantes && variantes.length > 0;
  const rawColorOptions = hasVariants
    ? [{ slug: slug || codigo_amigavel, cor: cor || '', image: image_url || '', estoque: estoque ?? 0, codigo_amigavel }, ...variantes]
    : [];
  // Sort: in-stock first, keeping relative order
  const allColorOptions = [...rawColorOptions].sort((a, b) => {
    const aIn = (a.estoque ?? 0) > 0 ? 1 : 0;
    const bIn = (b.estoque ?? 0) > 0 ? 1 : 0;
    return bIn - aIn;
  });
  // Use estoque_total when available (sums variants); fallback to legacy logic
  const aggregatedStock = estoque_total ?? (
    hasVariants
      ? (estoque ?? 0) + variantes.reduce((sum, v) => sum + (v.estoque ?? 0), 0)
      : (estoque ?? 0)
  );
  const isOutOfStock = aggregatedStock === 0;

  const displayImage = images.current[activeIdx] || preferredImage || image_url;


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
            width={400}
            height={400}
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

      <div className="p-3 sm:p-4 flex flex-col gap-1.5">
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
                const dotOutOfStock = (v.estoque ?? 0) === 0;
                return (
                  <Tooltip key={v.codigo_amigavel || i}>
                    <TooltipTrigger asChild>
                      <span
                        onMouseEnter={() => {
                          clearTimers();
                          isHovering.current = false;
                          const imgIdx = images.current.indexOf(v.image);
                          goToIndex(imgIdx >= 0 ? imgIdx : 0);
                        }}
                        onMouseLeave={() => {
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
                          opacity: dotOutOfStock ? 0.35 : 1,
                        }}
                      />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      {v.cor || 'Cor'}{dotOutOfStock ? ' — sem estoque' : ''}
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

        {faixas.length > 0 && (
          <div className="grid grid-cols-3 gap-1 mt-1.5">
            {faixas.map((f, i) => {
              const ultima = i === faixas.length - 1;
              const ativa = i === faixaAtiva;
              return (
                <button
                  key={f.qty}
                  type="button"
                  onClick={() => mudarQty(f.qty)}
                  className={`rounded-lg border px-0.5 py-1 text-center leading-tight transition-colors ${
                    ativa
                      ? "border-foreground bg-card ring-1 ring-foreground"
                      : ultima
                        ? "border-green-cta/40 bg-green-cta/10 hover:border-green-cta"
                        : "border-border bg-secondary hover:border-muted-foreground"
                  }`}
                >
                  <span className="block text-[9px] sm:text-[10px] text-muted-foreground whitespace-nowrap">{f.qty}{ultima ? "+" : ""}<span className={ultima ? "hidden sm:inline" : ""}> un.</span></span>
                  <span className={`block text-[11px] sm:text-xs font-bold whitespace-nowrap ${ultima ? "text-green-cta" : "text-foreground"}`}>
                    <span className="hidden sm:inline text-[9px] font-medium mr-0.5">R$</span>{formatarBRL(f.unit).replace(/^R\$\s?/, "")}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-1 mt-1.5 rounded-lg border border-border bg-card px-1">
          <button
            type="button"
            aria-label="Diminuir quantidade"
            onClick={() => mudarQty(qty - PASSO)}
            className="w-7 h-8 flex items-center justify-center text-foreground hover:text-green-cta shrink-0"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <input
            type="number"
            inputMode="numeric"
            min={QTD_MINIMA}
            aria-label={`Quantidade de ${nome}`}
            value={qtyInput}
            onChange={(e) => {
              setQtyInput(e.target.value);
              const n = parseInt(e.target.value);
              if (n >= QTD_MINIMA) setQty(n);
            }}
            onBlur={() => setQtyInput(String(qty))}
            className="flex-1 min-w-0 text-center text-sm font-semibold bg-transparent py-1 text-foreground focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <span className="text-[11px] text-muted-foreground -ml-1 mr-0.5">un</span>
          <button
            type="button"
            aria-label="Aumentar quantidade"
            onClick={() => mudarQty(qty + PASSO)}
            className="w-7 h-8 flex items-center justify-center text-foreground hover:text-green-cta shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        {unitAtual != null && (
          <span className="text-[11px] text-muted-foreground">
            Total: <b className="text-foreground">{formatarBRL(unitAtual * qty)}</b>
            <span className="hidden sm:inline"> ({formatarBRL(unitAtual)}/un)</span>
          </span>
        )}

        <button
          type="button"
          onClick={handleAdd}
          className="mt-1 w-full rounded-lg bg-green-cta py-2 text-sm font-bold text-white flex items-center justify-center gap-1.5 hover:brightness-110 active:scale-[0.98] transition-all"
        >
          {justAdded && <Check className="w-4 h-4" />}
          {justAdded ? "Adicionado!" : "Adicionar"}
        </button>
      </div>
    </div>
  );
};

export default ProductCard;
