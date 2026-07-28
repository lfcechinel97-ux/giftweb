import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatarBRL } from "@/utils/price";
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
const STEP = 5;

// Faixas de preço apresentadas no card. Descontos ilustrativos aplicados
// sobre o preco_final (0% / 3% / 6%).
const TIERS: Array<{ qty: number; discount: number }> = [
  { qty: 20, discount: 0 },
  { qty: 50, discount: 0.03 },
  { qty: 100, discount: 0.06 },
];

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
  badge,
}: Props) => {
  const { nome, image_url, image_urls, preco_final, cores } = product;
  const min = product.quantidade_minima ?? minQuantidade ?? DEFAULT_MIN;

  const editorial = !!size;

  const coresList = (cores ?? []).filter((c) => c && c.imagem);
  const [selectedCorIdx, setSelectedCorIdx] = useState<number | null>(null);

  // Imagem principal — NUNCA troca ao selecionar cor (regra de negócio).
  const primary = image_url || (image_urls && image_urls[0]) || null;
  const secondary =
    image_urls?.find((u) => u && u !== primary) ||
    (image_urls && image_urls.length > 1 ? image_urls[1] : null);

  const [hovering, setHovering] = useState(false);
  const [qtd, setQtd] = useState(min);

  const dec = (e: React.MouseEvent) => {
    e.stopPropagation();
    setQtd((q) => Math.max(min, q - STEP));
  };
  const inc = (e: React.MouseEvent) => {
    e.stopPropagation();
    setQtd((q) => q + STEP);
  };
  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAdd?.(product, qtd);
  };
  const open = () => onOpen?.(product);

  // Bloco de 3 faixas de preço
  const PriceTiers = () => (
    <div className="grid grid-cols-3 gap-2 mt-3">
      {TIERS.map((t) => {
        const unit = preco_final != null ? preco_final * (1 - t.discount) : null;
        return (
          <div
            key={t.qty}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-center"
          >
            <div className="text-[10px] font-normal text-slate-400 tracking-wider">
              {t.qty} un
            </div>
            <div className="text-[13px] font-medium text-navy tabular-nums leading-tight">
              {unit != null ? formatarBRL(unit) : "—"}
            </div>
          </div>
        );
      })}
    </div>
  );

  // Swatches de cor (não trocam a imagem)
  const ColorSwatches = () =>
    coresList.length > 0 ? (
      <div className="flex flex-wrap items-center gap-2 mt-3">
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
                "relative w-8 h-8 rounded-full overflow-hidden transition-all",
                active
                  ? "ring-2 ring-offset-2 ring-green-cta scale-105"
                  : "ring-1 ring-slate-200 hover:ring-navy/40"
              )}
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

  // Bloco de ação — qty selector + botão "Adicionar ao orçamento"
  const ActionRow = ({ full = false }: { full?: boolean }) => (
    <div className="flex items-stretch gap-2 mt-4">
      <div className="flex items-center border border-slate-200 rounded-full h-10 px-1 shrink-0">
        <button
          type="button"
          onClick={dec}
          aria-label={`Diminuir ${STEP}`}
          className="w-8 h-8 flex items-center justify-center text-navy/70 hover:text-navy"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <span className="text-xs font-medium text-navy tabular-nums min-w-[3ch] text-center">
          {qtd}
        </span>
        <button
          type="button"
          onClick={inc}
          aria-label={`Aumentar ${STEP}`}
          className="w-8 h-8 flex items-center justify-center text-green-cta hover:brightness-110"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
      <button
        type="button"
        onClick={handleAdd}
        className={cn(
          "flex-1 h-10 rounded-full bg-green-cta text-white text-[11px] font-medium tracking-[0.12em] uppercase transition-transform hover:scale-[1.02] hover:brightness-110",
          full ? "px-4" : "px-3"
        )}
      >
        Adicionar ao orçamento
      </button>
    </div>
  );

  // ─── Modo Editorial ────────────────────────────────────────────────────
  if (editorial) {
    const isL = size === "L";
    const isM = size === "M";

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
            "relative w-full flex-1 overflow-hidden text-left rounded-2xl md:rounded-3xl bg-white",
            "border border-slate-200 shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
            "hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)] hover:border-green-cta/40 transition-all duration-300",
            minHeight
          )}
          aria-label={`Ver detalhes de ${nome}`}
        >
          {badge && (
            <div className="absolute top-4 left-4 md:top-5 md:left-5 z-10">
              <span className="text-[10px] md:text-[11px] font-medium uppercase tracking-[0.22em] px-2.5 py-1 rounded-full bg-navy text-white">
                {badge}
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

        <div className="mt-4 px-1">
          <button type="button" onClick={open} className="text-left w-full">
            <h3
              className={cn(
                "font-normal text-navy leading-snug tracking-tight hover:text-green-cta transition-colors line-clamp-2",
                isL ? "text-lg md:text-xl" : "text-sm md:text-base"
              )}
            >
              {nome}
            </h3>
          </button>

          <ColorSwatches />
          <PriceTiers />
          <ActionRow full={isL} />
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
          "hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)] hover:border-green-cta/40 transition-all",
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
            <span className="text-[10px] font-medium px-2.5 py-1 uppercase tracking-[0.22em] rounded-full text-white bg-navy">
              {badge}
            </span>
          </div>
        )}
      </button>

      <div className="mt-4 px-1">
        <button type="button" onClick={open} className="text-left w-full">
          <h3
            className={cn(
              "font-normal text-navy leading-snug tracking-tight hover:text-green-cta transition-colors line-clamp-2",
              variant === "hero" ? "text-xl md:text-2xl" : "text-sm md:text-base"
            )}
          >
            {nome}
          </h3>
        </button>

        <ColorSwatches />
        <PriceTiers />
        <ActionRow full={variant === "hero"} />
      </div>
    </article>
  );
};

export default TopProductCard;
