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
  tile?: Tile;
}

const DEFAULT_MIN = 20;
const ACCENT = "#2563EB"; // azul de destaque

const ASPECT_LEGACY: Record<TopProductVariant, string> = {
  hero: "aspect-[16/9]",
  side: "aspect-square",
  grid: "aspect-[3/4]",
};

const DEFAULT_TILE: Tile = {
  bg: "#FFFFFF",
  ink: "#0B1F3A",
  accent: ACCENT,
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
  const { nome, image_url, image_urls, preco_custo, quantidade_minima, preco_final, cores } = product;
  const min = quantidade_minima ?? minQuantidade ?? DEFAULT_MIN;
  const tile = tileProp ?? DEFAULT_TILE;

  const editorial = !!size;

  const coresList = (cores ?? []).filter((c) => c && c.imagem);
  const [selectedCorIdx, setSelectedCorIdx] = useState<number | null>(null);
  const selectedCor = selectedCorIdx != null ? coresList[selectedCorIdx] : null;

  const basePrimary = image_url || (image_urls && image_urls[0]) || null;
  const primary = selectedCor?.imagem || basePrimary;
  const secondary =
    image_urls?.find((u) => u && u !== primary) ||
    (image_urls && image_urls.length > 1 ? image_urls[1] : null);

  const [hovering, setHovering] = useState(false);
  const [qtd] = useState(min);

  const precoUnit =
    preco_final != null ? preco_final : preco_custo != null ? calcularPreco(preco_custo, min) : null;
  const precoFmt = precoUnit != null ? formatarBRL(precoUnit) : "R$ --,--";

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAdd?.(product, qtd);
  };
  const open = () => onOpen?.(product);

  // Bloco de preço reutilizado — "A partir de" + valor
  const PriceBlock = ({ large = false }: { large?: boolean }) => (
    <div className="flex flex-col leading-tight">
      <span className="text-[10px] md:text-[11px] uppercase tracking-[0.18em] text-slate-400 font-medium">
        A partir de
      </span>
      <span
        className={cn(
          "font-semibold tabular-nums text-navy",
          large ? "text-xl md:text-2xl" : "text-base md:text-lg"
        )}
      >
        {precoFmt}
      </span>
    </div>
  );

  // Swatches de cor reutilizáveis
  const ColorSwatches = () =>
    coresList.length > 0 ? (
      <div className="flex flex-wrap items-center gap-2.5 mt-3 px-1">
        {coresList.map((c, i) => {
          const active = selectedCorIdx === i;
          return (
            <button
              key={`${c.referencia ?? c.nome}-${i}`}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedCorIdx(active ? null : i);
              }}
              title={c.nome}
              aria-label={`Cor ${c.nome}`}
              aria-pressed={active}
              className={cn(
                "relative w-9 h-9 rounded-full overflow-hidden transition-all",
                active
                  ? "ring-2 ring-offset-2 ring-[color:var(--sw-accent)] scale-105"
                  : "ring-1 ring-slate-200 hover:ring-slate-400"
              )}
              style={{ ["--sw-accent" as any]: ACCENT }}
            >
              <img
                src={c.imagem}
                alt={c.nome}
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover"
              />
            </button>
          );
        })}
      </div>
    ) : null;

  // ─── Modo Editorial ────────────────────────────────────────────────────
  if (editorial) {
    const isL = size === "L";
    const isM = size === "M";
    const isS = size === "S";

    // Imagem ocupa mais espaço, menos padding vazio
    const imgScale = isL
      ? "w-[92%] h-[86%]"
      : isM
      ? "w-[85%] h-[80%]"
      : "w-[80%] h-[78%]";

    const imgAnchor = isL ? "items-start pt-6 md:pt-10" : "items-center";

    const minHeight = isL
      ? "min-h-[420px] md:min-h-[520px]"
      : isM
      ? "min-h-[280px] md:min-h-[340px]"
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
            "relative w-full flex-1 overflow-hidden text-left rounded-2xl md:rounded-3xl",
            "border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
            "hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)] transition-shadow duration-300",
            minHeight
          )}
          style={{ backgroundColor: tile.bg }}
          aria-label={`Ver detalhes de ${nome}`}
        >
          {(isL || (isM && badge)) && (
            <div className="absolute top-4 left-4 md:top-5 md:left-5 z-10">
              <span
                className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.22em] px-2.5 py-1 rounded-full"
                style={{ backgroundColor: ACCENT, color: "#FFFFFF" }}
              >
                {badge ?? (isL ? "Destaque" : "Novo")}
              </span>
            </div>
          )}

          <div className={cn("absolute inset-0 flex justify-center px-3 md:px-4", imgAnchor)}>
            {primary && (
              <img
                src={primary}
                alt={nome}
                loading="lazy"
                className={cn(
                  "object-contain transition-all duration-500 group-hover:scale-[1.03]",
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
                  "absolute object-contain transition-opacity duration-500 hidden md:block",
                  imgScale,
                  isL ? "top-10" : "top-1/2 -translate-y-1/2",
                  hovering ? "opacity-100" : "opacity-0"
                )}
              />
            )}
          </div>
        </button>

        <ColorSwatches />

        {/* Info abaixo do tile — padrão consistente para S/M/L */}
        <div className="mt-4 px-1">
          <button type="button" onClick={open} className="text-left w-full">
            <h3
              className={cn(
                "font-semibold text-navy leading-snug tracking-tight hover:text-[color:var(--acc)] transition-colors line-clamp-2",
                isL ? "text-lg md:text-xl" : "text-sm md:text-base"
              )}
              style={{ ["--acc" as any]: ACCENT }}
            >
              {nome}
            </h3>
          </button>
          <div className="flex items-end justify-between gap-3 mt-3">
            <div className="flex flex-col leading-tight">
              <PriceBlock large={isL} />
              <span className="text-[10px] uppercase tracking-[0.18em] text-slate-400 mt-1">
                Mínimo {min} un
              </span>
            </div>
            <button
              type="button"
              onClick={handleAdd}
              aria-label="Adicionar ao pedido"
              className={cn(
                "shrink-0 inline-flex items-center gap-1.5 rounded-full text-white text-xs font-bold uppercase tracking-[0.12em] transition-transform hover:scale-[1.03]",
                isL ? "px-4 py-2.5" : "px-3 py-2"
              )}
              style={{ backgroundColor: ACCENT }}
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar
            </button>
          </div>
          {eyebrow && isS && (
            <span className="block text-[10px] text-slate-400 uppercase tracking-[0.18em] mt-2">
              {eyebrow}
            </span>
          )}
        </div>
      </article>
    );
  }

  // ─── Legacy variants ────────────────────────────────────────────────────
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
          "relative w-full overflow-hidden cursor-pointer text-left rounded-2xl border border-slate-200 bg-white",
          "hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)] transition-shadow",
          ASPECT_LEGACY[variant]
        )}
        aria-label={`Ver detalhes de ${nome}`}
      >
        {primary && (
          <img
            src={primary}
            alt={nome}
            loading="lazy"
            className={cn(
              "absolute inset-0 w-full h-full object-contain transition-all duration-500 group-hover:scale-[1.04]",
              variant === "hero" ? "p-6 md:p-10" : "p-3 md:p-4",
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
              "absolute inset-0 w-full h-full object-contain transition-opacity duration-500 hidden md:block",
              variant === "hero" ? "p-6 md:p-10" : "p-3 md:p-4",
              hovering ? "opacity-100" : "opacity-0"
            )}
          />
        )}
        {badge && (
          <div className="absolute top-4 left-4">
            <span
              className="text-[10px] font-bold px-2.5 py-1 uppercase tracking-[0.22em] rounded-full text-white"
              style={{ backgroundColor: ACCENT }}
            >
              {badge}
            </span>
          </div>
        )}
      </button>

      <ColorSwatches />

      <div className="mt-4 px-1">
        <button type="button" onClick={open} className="text-left w-full">
          <h3
            className={cn(
              "font-semibold text-navy leading-snug tracking-tight hover:text-[color:var(--acc)] transition-colors line-clamp-2",
              variant === "hero" ? "text-xl md:text-2xl" : "text-sm md:text-base"
            )}
            style={{ ["--acc" as any]: ACCENT }}
          >
            {nome}
          </h3>
        </button>
        <div className="flex items-end justify-between gap-3 mt-3">
          <div className="flex flex-col leading-tight">
            <PriceBlock large={variant === "hero"} />
            <span className="text-[10px] uppercase tracking-[0.18em] text-slate-400 mt-1">
              Mínimo {min} un
            </span>
          </div>
          <button
            type="button"
            onClick={handleAdd}
            aria-label="Adicionar ao pedido"
            className="shrink-0 inline-flex items-center gap-1.5 rounded-full text-white text-xs font-bold uppercase tracking-[0.12em] px-3 py-2 transition-transform hover:scale-[1.03]"
            style={{ backgroundColor: ACCENT }}
          >
            <Plus className="w-3.5 h-3.5" />
            Adicionar
          </button>
        </div>
      </div>
    </article>
  );
};

export default TopProductCard;
