import { useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { calcularPreco, formatarBRL } from "@/utils/price";
import type { Tile } from "./categoryPalettes";

export interface TopProductCor {
  nome: string;
  imagem: string;
  referencia?: string | null;
}

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
  cores?: TopProductCor[];
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
  tile?: Tile; // paleta do tile (cores por categoria)
}

const DEFAULT_MIN = 20;

const ASPECT_LEGACY: Record<TopProductVariant, string> = {
  hero: "aspect-[16/9]",
  side: "aspect-square",
  grid: "aspect-[3/4]",
};

const DEFAULT_TILE: Tile = {
  bg: "#F1E9DE",
  ink: "#0B1F3A",
  accent: "#0B1F3A",
  accentInk: "#FFFFFF",
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
  tile: tileProp,
}: Props) => {
  const { nome, image_url, image_urls, preco_custo, quantidade_minima, preco_final, imagem_editorial } = product;
  const min = quantidade_minima ?? minQuantidade ?? DEFAULT_MIN;
  const tile = tileProp ?? DEFAULT_TILE;

  const editorial = !!size;

  // Modo editorial: sempre PNG/produto flutuando (não a foto lifestyle "cropada").
  // Preferimos a foto de fundo transparente/estúdio do catálogo — imagem_editorial só entra para L com opção.
  const primary = image_url || (image_urls && image_urls[0]) || null;
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

  // ─── Modo Editorial: tile colorido + produto flutuando ────────────────
  if (editorial) {
    const isL = size === "L";
    const isM = size === "M";
    const isS = size === "S";

    // Escala dramática do produto dentro do tile — S bem pequeno, L bem grande.
    const imgScale = isL
      ? "w-[78%] h-[78%]"
      : isM
      ? "w-[65%] h-[65%]"
      : "w-[42%] h-[42%]";

    // Posição do produto no tile: L centralizado empurrado pra cima; M centralizado; S centralizado.
    const imgAnchor = isL ? "items-start pt-10 md:pt-14" : "items-center";

    const minHeight = isL
      ? "min-h-[440px] md:min-h-[560px]"
      : isM
      ? "min-h-[300px] md:min-h-[360px]"
      : "min-h-[220px] md:min-h-[260px]";

    return (
      <article
        className="group flex flex-col h-full animate-fade-in"
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
      >
        <button
          type="button"
          onClick={open}
          className={cn(
            "relative w-full flex-1 overflow-hidden text-left rounded-[28px] md:rounded-[36px]",
            "transition-shadow duration-500",
            minHeight
          )}
          style={{ backgroundColor: tile.bg }}
          aria-label={`Ver detalhes de ${nome}`}
        >
          {/* Rótulo DESTAQUE (só L e M) */}
          {(isL || (isM && badge)) && (
            <div className="absolute top-5 left-5 md:top-6 md:left-6 z-10">
              <span
                className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.25em] px-3 py-1.5 rounded-full"
                style={{ backgroundColor: tile.accent, color: tile.accentInk }}
              >
                {badge ?? (isL ? "Destaque" : "Novo")}
              </span>
            </div>
          )}

          {/* Produto flutuando */}
          <div className={cn("absolute inset-0 flex justify-center px-6", imgAnchor)}>
            {primary && (
              <img
                src={primary}
                alt={nome}
                loading="lazy"
                className={cn(
                  "object-contain transition-all duration-500 group-hover:scale-[1.05] drop-shadow-[0_20px_30px_rgba(0,0,0,0.12)]",
                  imgScale,
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
                  "absolute object-contain transition-opacity duration-500 hidden md:block drop-shadow-[0_20px_30px_rgba(0,0,0,0.12)]",
                  imgScale,
                  isL ? "top-14 md:top-14" : "top-1/2 -translate-y-1/2",
                  hovering ? "opacity-100" : "opacity-0"
                )}
              />
            )}
          </div>

          {/* Info dentro do tile — só L e M (S mantém fora, minimalíssimo) */}
          {(isL || isM) && (
            <div
              className={cn(
                "absolute inset-x-0 bottom-0 px-6 md:px-8 pb-6 md:pb-8 pt-16",
                "bg-gradient-to-t from-black/5 to-transparent"
              )}
            >
              <h3
                className={cn(
                  "font-bold leading-tight tracking-tight",
                  isL ? "text-2xl md:text-4xl" : "text-lg md:text-2xl"
                )}
                style={{ color: tile.ink }}
              >
                {nome}
              </h3>
              <div className="flex items-baseline gap-3 mt-2 md:mt-3">
                <span
                  className={cn("font-medium tabular-nums", isL ? "text-lg md:text-xl" : "text-base")}
                  style={{ color: tile.ink }}
                >
                  {precoFmt}
                </span>
                <span
                  className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-70"
                  style={{ color: tile.ink }}
                >
                  · MOQ {min}
                </span>
              </div>
            </div>
          )}
        </button>

        {/* Info fora do tile — SÓ para tamanho S (mantém tile puramente visual) */}
        {isS && (
          <div className="mt-4 px-1">
            <div className="flex justify-between items-start gap-3">
              <button type="button" onClick={open} className="text-left min-w-0 flex-1">
                <h3 className="text-sm md:text-[15px] font-semibold text-navy leading-snug hover:text-green-cta transition-colors line-clamp-2">
                  {nome}
                </h3>
              </button>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-navy font-medium text-sm tabular-nums">{precoFmt}</span>
              <button
                type="button"
                onClick={handleAdd}
                aria-label="Adicionar ao pedido"
                className="w-7 h-7 rounded-full bg-navy text-white flex items-center justify-center hover:bg-green-cta transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* CTA "Adicionar" para L/M — abaixo do tile, minimalista */}
        {(isL || isM) && (
          <div className={cn("flex items-center justify-between gap-3 mt-4 md:mt-5 px-1")}>
            {eyebrow && (
              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.25em]">
                {eyebrow}
              </span>
            )}
            <button
              type="button"
              onClick={handleAdd}
              className="inline-flex items-center gap-1.5 text-navy text-[11px] font-bold uppercase tracking-[0.2em] hover:text-green-cta transition-colors ml-auto"
            >
              Adicionar
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </article>
    );
  }

  // ─── Legacy variants (hero/side/grid) — usados em MaisVendidosSection ────
  return (
    <article
      className="group flex flex-col animate-fade-in"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <button
        type="button"
        onClick={open}
        className={cn(
          "relative w-full overflow-hidden cursor-pointer text-left rounded-[28px] md:rounded-[36px]",
          ASPECT_LEGACY[variant]
        )}
        style={{ backgroundColor: tile.bg }}
        aria-label={`Ver detalhes de ${nome}`}
      >
        {primary && (
          <img
            src={primary}
            alt={nome}
            loading="lazy"
            className={cn(
              "absolute inset-0 w-full h-full object-contain transition-all duration-500 group-hover:scale-[1.04] drop-shadow-[0_20px_30px_rgba(0,0,0,0.12)]",
              variant === "hero" ? "p-16 md:p-24" : "p-10 md:p-14",
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
              "absolute inset-0 w-full h-full object-contain transition-opacity duration-500 hidden md:block drop-shadow-[0_20px_30px_rgba(0,0,0,0.12)]",
              variant === "hero" ? "p-16 md:p-24" : "p-10 md:p-14",
              hovering ? "opacity-100" : "opacity-0"
            )}
          />
        )}
        {badge && (
          <div className="absolute top-6 left-6">
            <span
              className="text-[10px] font-bold px-3 py-1.5 uppercase tracking-[0.25em] rounded-full"
              style={{ backgroundColor: tile.accent, color: tile.accentInk }}
            >
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
