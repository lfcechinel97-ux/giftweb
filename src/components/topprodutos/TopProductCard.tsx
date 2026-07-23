import { useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { calcularPreco, formatarBRL } from "@/utils/price";

export interface TopProduct {
  id: string;
  nome: string;
  image_url: string | null;
  image_urls?: string[] | null;
  preco_custo: number | null;
  codigo_amigavel: string;
  quantidade_minima?: number | null;
  preco_final?: number | null;
  descricao_curta?: string | null;
  imagem_editorial?: string | null;
}

export type TopProductVariant = "hero" | "side" | "grid";
export type TopProductSize = "S" | "M" | "L";

interface Props {
  product: TopProduct;
  minQuantidade?: number;
  onAdd?: (product: TopProduct, quantidade: number) => void;
  onOpen?: (product: TopProduct) => void;
  variant?: TopProductVariant;
  size?: TopProductSize;
  eyebrow?: string;
  badge?: string;
}

const DEFAULT_MIN = 20;

const ASPECT_LEGACY: Record<TopProductVariant, string> = {
  hero: "aspect-[16/9]",
  side: "aspect-square",
  grid: "aspect-[3/4]",
};

const TopProductCard = ({
  product,
  minQuantidade,
  onAdd,
  onOpen,
  variant = "grid",
  size,
  eyebrow,
  badge,
}: Props) => {
  const { nome, image_url, image_urls, preco_custo, quantidade_minima, preco_final, imagem_editorial } = product;
  const min = quantidade_minima ?? minQuantidade ?? DEFAULT_MIN;

  // Editorial mode: when a size is provided, use mosaic layout with lifestyle-first imagery.
  const editorial = !!size;

  const preferEditorial = editorial && size !== "S" && !!imagem_editorial;
  const primary = preferEditorial
    ? imagem_editorial!
    : image_url || (image_urls && image_urls[0]) || null;
  const secondary =
    image_urls?.find((u) => u && u !== primary) ||
    (image_urls && image_urls.length > 1 ? image_urls[1] : null);

  const [hovering, setHovering] = useState(false);
  const [qtd, setQtd] = useState(min);

  const precoUnit =
    preco_final != null ? preco_final : preco_custo != null ? calcularPreco(preco_custo, min) : null;
  const precoFmt = precoUnit != null ? formatarBRL(precoUnit) : "R$ --,--";

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAdd?.(product, qtd);
  };
  const open = () => onOpen?.(product);

  // ─── Editorial mosaic sizes ─────────────────────────────────────
  if (editorial) {
    const isL = size === "L";
    const isM = size === "M";

    const imgFit = preferEditorial ? "object-cover" : "object-contain";
    const padding = preferEditorial ? "p-0" : isL ? "p-10 md:p-14" : isM ? "p-6 md:p-10" : "p-4 md:p-6";
    const bg = preferEditorial ? "bg-slate-100" : "bg-[#f4f2ed]";
    const aspect = isL ? "h-full min-h-[520px]" : isM ? "h-full min-h-[340px]" : "aspect-[4/5]";

    const titleClass = isL
      ? "text-2xl md:text-4xl font-bold text-navy leading-tight tracking-tight"
      : isM
      ? "text-lg md:text-2xl font-bold text-navy leading-tight"
      : "text-sm md:text-base font-semibold text-navy leading-snug";

    return (
      <article
        className="group flex flex-col h-full animate-fade-in"
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <button
          type="button"
          onClick={open}
          className={cn("relative w-full overflow-hidden cursor-pointer text-left flex-1", bg, aspect)}
          aria-label={`Ver detalhes de ${nome}`}
        >
          {primary && (
            <img
              src={primary}
              alt={nome}
              loading="lazy"
              className={cn(
                "absolute inset-0 w-full h-full transition-all duration-500 group-hover:scale-[1.03]",
                imgFit,
                padding,
                hovering && secondary ? "opacity-0" : "opacity-100"
              )}
            />
          )}
          {secondary && (
            <img
              src={secondary}
              alt={nome}
              loading="lazy"
              aria-hidden="true"
              className={cn(
                "absolute inset-0 w-full h-full transition-opacity duration-500 hidden md:block",
                imgFit,
                padding,
                hovering ? "opacity-100" : "opacity-0"
              )}
            />
          )}
          {badge && (
            <div className={cn("absolute", isL ? "top-6 left-6" : "top-4 left-4")}>
              <span className="bg-navy text-white text-[10px] font-bold px-3 py-1.5 uppercase tracking-widest">
                {badge}
              </span>
            </div>
          )}
          {isL && preferEditorial && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/40 to-transparent" />
          )}
        </button>

        {/* Info */}
        <div className={cn("mt-4", isL ? "md:mt-6" : "mt-3")}>
          {eyebrow && (
            <p className={cn(
              "text-slate-400 uppercase tracking-widest mb-1",
              isL ? "text-xs" : "text-[10px]"
            )}>
              {eyebrow}
            </p>
          )}
          <div className="flex justify-between items-start gap-3">
            <button type="button" onClick={open} className="text-left min-w-0 flex-1">
              <h3 className={cn(titleClass, "hover:text-green-cta transition-colors")}>{nome}</h3>
            </button>
            <span className={cn(
              "shrink-0 text-navy font-medium tabular-nums",
              isL ? "text-lg md:text-xl" : isM ? "text-base" : "text-sm"
            )}>
              {precoFmt}
            </span>
          </div>
          {isL && product.descricao_curta && (
            <p className="text-slate-500 mt-3 text-base leading-relaxed max-w-md">
              {product.descricao_curta}
            </p>
          )}
          <div className={cn(
            "flex items-center justify-between gap-3 mt-4 pt-3 border-t",
            isL ? "border-slate-200" : "border-slate-100"
          )}>
            <span className="text-green-cta text-[10px] font-bold uppercase tracking-widest">
              MOQ: {min} un
            </span>
            <button
              type="button"
              onClick={handleAdd}
              className="inline-flex items-center gap-1.5 text-navy text-[11px] font-bold uppercase tracking-widest hover:text-green-cta transition-colors"
            >
              Adicionar
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </article>
    );
  }

  // ─── Legacy variants (hero/side/grid) for MaisVendidosSection ────────
  return (
    <article
      className="group flex flex-col animate-fade-in"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <button
        type="button"
        onClick={open}
        className={cn("relative w-full overflow-hidden bg-slate-100 cursor-pointer text-left", ASPECT_LEGACY[variant])}
        aria-label={`Ver detalhes de ${nome}`}
      >
        {primary && (
          <img
            src={primary}
            alt={nome}
            loading="lazy"
            className={cn(
              "absolute inset-0 w-full h-full object-contain p-6 transition-all duration-500 group-hover:scale-[1.02]",
              hovering && secondary ? "opacity-0" : "opacity-100"
            )}
          />
        )}
        {secondary && (
          <img
            src={secondary}
            alt={nome}
            loading="lazy"
            aria-hidden="true"
            className={cn(
              "absolute inset-0 w-full h-full object-contain p-6 transition-opacity duration-500 hidden md:block",
              hovering ? "opacity-100" : "opacity-0"
            )}
          />
        )}
        {badge && (
          <div className="absolute top-6 left-6">
            <span className="bg-navy text-white text-[10px] font-bold px-4 py-1.5 uppercase tracking-widest">
              {badge}
            </span>
          </div>
        )}
      </button>

      {variant === "hero" && (
        <div className="mt-8 flex flex-col md:flex-row justify-between items-start gap-6">
          <div className="min-w-0">
            <button type="button" onClick={open} className="text-left">
              <h3 className="text-2xl md:text-3xl font-bold text-navy leading-tight tracking-tight hover:text-green-cta transition-colors">{nome}</h3>
            </button>
            {product.descricao_curta && (
              <p className="text-slate-500 mt-2 text-base md:text-lg leading-relaxed max-w-md">
                {product.descricao_curta}
              </p>
            )}
          </div>
          <div className="md:text-right shrink-0">
            <span className="block text-2xl md:text-3xl font-light text-navy">{precoFmt}</span>
            <span className="block text-green-cta text-xs font-bold mt-2 uppercase tracking-widest">
              MOQ: {min} Unidades
            </span>
          </div>
        </div>
      )}

      {variant === "side" && (
        <div className="mt-4">
          <button type="button" onClick={open} className="text-left w-full">
            <h4 className="text-lg md:text-xl font-bold text-navy leading-tight hover:text-green-cta transition-colors">{nome}</h4>
          </button>
          <div className="flex justify-between items-center mt-2 border-t border-slate-200 pt-3">
            <span className="text-slate-500 text-sm">{precoFmt}</span>
            <span className="text-green-cta text-[10px] font-bold uppercase tracking-widest">
              MOQ: {min}un
            </span>
          </div>
        </div>
      )}

      {variant === "grid" && (
        <div className="mt-6 space-y-1">
          <div className="flex justify-between gap-3">
            <button type="button" onClick={open} className="text-left min-w-0">
              <h5 className="text-navy font-bold text-base md:text-lg leading-tight hover:text-green-cta transition-colors">{nome}</h5>
            </button>
            <span className="text-navy font-medium text-sm md:text-base shrink-0">{precoFmt}</span>
          </div>
          {eyebrow && (
            <p className="text-slate-400 text-[10px] uppercase tracking-widest">{eyebrow}</p>
          )}
          <div className="pt-4 border-t border-slate-100">
            <span className="text-green-cta text-[10px] font-black uppercase tracking-widest">
              MOQ: {min} un
            </span>
          </div>
        </div>
      )}

      {/* Ação legada */}
      <div className="mt-4">
        <button
          type="button"
          onClick={handleAdd}
          className={cn(
            "inline-flex items-center gap-2 text-navy text-xs font-bold uppercase tracking-widest",
            "border-b border-navy/30 hover:border-green-cta hover:text-green-cta pb-1 transition-colors"
          )}
        >
          Adicionar ao pedido
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
    </article>
  );
};

export default TopProductCard;
