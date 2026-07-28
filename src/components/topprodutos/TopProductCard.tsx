import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatarBRL } from "@/utils/price";
import { getCorHex } from "@/utils/colorHex";
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

export interface TopProductAddExtras {
  sku?: string;
  cor?: string;
  image?: string | null;
}

interface Props {
  product: TopProduct;
  minQuantidade?: number;
  onAdd?: (product: TopProduct, quantidade: number, extras?: TopProductAddExtras) => void;
  onOpen?: (product: TopProduct) => void;
  variant?: TopProductVariant;
  size?: TopProductSize;
  eyebrow?: string;
  badge?: string;
  tile?: Tile;
}

const DEFAULT_MIN = 20;
const STEP = 5;

const TIERS: Array<{ qty: number; discount: number }> = [
  { qty: 20, discount: 0 },
  { qty: 50, discount: 0.03 },
  { qty: 100, discount: 0.06 },
];

const isValidHex = (v?: string | null) =>
  !!v && /^#?[0-9a-fA-F]{3,8}$/.test(v.trim());

const normalizeHex = (v: string) => (v.trim().startsWith("#") ? v.trim() : `#${v.trim()}`);

const TopProductCard = ({
  product,
  minQuantidade,
  onAdd,
  onOpen,
  badge,
}: Props) => {
  const { nome, image_url, image_urls, preco_final, cores } = product;
  const min = product.quantidade_minima ?? minQuantidade ?? DEFAULT_MIN;

  // Todas as cores viram bolinha: usa hex de `referencia` quando válido,
  // ou mapeia pelo nome (ex.: "AZUL", "VERDE ESCURO") em fallback.
  const coresList = (cores ?? []).filter((c) => c && (c.nome || c.referencia));
  const swatchColor = (c: TopProductCor) =>
    isValidHex(c.referencia) ? normalizeHex(c.referencia!) : getCorHex(c.nome);
  const [selectedCorIdx, setSelectedCorIdx] = useState<number | null>(null);

  const baseImage = image_url || (image_urls && image_urls[0]) || null;
  const selectedCor = selectedCorIdx != null ? coresList[selectedCorIdx] : null;
  const primary = selectedCor?.imagem || baseImage;
  const secondary =
    image_urls?.find((u) => u && u !== primary) ||
    (image_urls && image_urls.length > 1 ? image_urls[1] : null);

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
    onAdd?.(product, qtd, {
      sku: product.codigo_amigavel,
      cor: selectedCor?.nome,
      image: selectedCor?.imagem || product.image_url,
    });
  };
  const open = () => onOpen?.(product);

  const PriceTiers = () => (
    <div className="grid grid-cols-3 gap-1 md:gap-2 mt-2 md:mt-2.5">
      {TIERS.map((t) => {
        const unit = preco_final != null ? preco_final * (1 - t.discount) : null;
        const active = qtd === t.qty;
        return (
          <button
            key={t.qty}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setQtd(Math.max(min, t.qty));
            }}
            className={cn(
              "rounded md:rounded-lg border px-0.5 md:px-2 py-0.5 md:py-1.5 text-center transition-colors min-w-0",
              active
                ? "border-green-cta bg-green-cta/5"
                : "border-slate-200 hover:border-navy/30"
            )}
          >
            <div className="text-[8px] md:text-[10px] font-normal text-slate-400 tracking-wide leading-tight">
              {t.qty} un
            </div>
            <div className="text-[10px] md:text-[13px] font-medium text-navy tabular-nums leading-tight whitespace-nowrap">
              {unit != null ? formatarBRL(unit) : "—"}
            </div>
          </button>
        );
      })}
    </div>
  );

  const ColorSwatches = () =>
    coresList.length > 1 ? (
      <div className="flex flex-wrap items-center gap-1 md:gap-2 mt-2 md:mt-2.5">
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
              style={{ background: swatchColor(c) }}
              className={cn(
                "w-4 h-4 md:w-6 md:h-6 rounded-full transition-all",
                active
                  ? "ring-2 ring-offset-1 md:ring-offset-2 ring-green-cta scale-110"
                  : "ring-1 ring-slate-200 hover:ring-navy/40"
              )}
            />
          );
        })}
      </div>
    ) : null;

  const ActionRow = () => (
    <div className="flex flex-col md:flex-row items-stretch gap-2 mt-3 md:mt-4">
      <div className="flex items-center justify-between md:justify-start border border-slate-200 rounded-full h-9 md:h-10 px-1 shrink-0 self-stretch md:self-auto">
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
        className="flex-1 h-9 md:h-10 rounded-full bg-green-cta text-white text-xs md:text-sm font-medium transition-colors hover:brightness-105 px-3 whitespace-nowrap"
      >
        <span className="md:hidden">Adicionar</span>
        <span className="hidden md:inline">Adicionar ao orçamento</span>
      </button>
    </div>
  );

  return (
    <article className="group flex flex-col h-full animate-fade-in">
      <button
        type="button"
        onClick={open}
        className="relative w-full aspect-[4/5] overflow-hidden text-left rounded-xl md:rounded-2xl bg-white"
        aria-label={`Ver detalhes de ${nome}`}
      >
        {badge && (
          <div className="absolute top-2 left-2 md:top-3 md:left-3 z-10">
            <span className="text-[9px] md:text-[10px] font-medium uppercase tracking-[0.22em] px-2 py-0.5 md:px-2.5 md:py-1 rounded-full bg-navy text-white">
              {badge}
            </span>
          </div>
        )}
        {primary && (
          <img
            src={primary}
            alt={nome}
            loading="lazy"
            decoding="async"
            className={cn(
              "absolute inset-0 w-full h-full object-contain p-3 sm:p-6 transition-opacity duration-500",
              secondary && !selectedCor ? "md:group-hover:opacity-0" : ""
            )}
          />
        )}
        {secondary && !selectedCor && (
          <img
            src={secondary}
            alt={nome}
            loading="lazy"
            decoding="async"
            aria-hidden="true"
            className="absolute inset-0 w-full h-full object-contain p-3 sm:p-6 transition-opacity duration-500 hidden md:block opacity-0 md:group-hover:opacity-100"
          />
        )}
      </button>

      <div className="mt-3 md:mt-4 px-0.5 md:px-1">
        <button type="button" onClick={open} className="text-left w-full">
          <h3 className="font-normal text-navy leading-snug tracking-tight hover:text-green-cta transition-colors line-clamp-2 text-[13px] md:text-base">
            {nome}
          </h3>
        </button>

        <ColorSwatches />
        <PriceTiers />
        <ActionRow />
      </div>
    </article>
  );
};

export default TopProductCard;
