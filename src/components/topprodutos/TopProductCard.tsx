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

  const PriceTiers = () => (
    <div className="grid grid-cols-3 gap-2 mt-3">
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
              "rounded-lg border px-2 py-1.5 text-center transition-colors",
              active
                ? "border-green-cta bg-green-cta/5"
                : "border-slate-200 hover:border-navy/30"
            )}
          >
            <div className="text-[10px] font-normal text-slate-400 tracking-wider">
              {t.qty} un
            </div>
            <div className="text-[13px] font-medium text-navy tabular-nums leading-tight">
              {unit != null ? formatarBRL(unit) : "—"}
            </div>
          </button>
        );
      })}
    </div>
  );

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
              style={{ background: swatchColor(c) }}
              className={cn(
                "w-6 h-6 rounded-full transition-all",
                active
                  ? "ring-2 ring-offset-2 ring-green-cta scale-110"
                  : "ring-1 ring-slate-200 hover:ring-navy/40"
              )}
            />
          );
        })}
      </div>
    ) : null;

  const ActionRow = () => (
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
        className="flex-1 h-10 rounded-full bg-green-cta text-white text-sm font-medium transition-colors hover:brightness-105 px-3"
      >
        Adicionar ao orçamento
      </button>
    </div>
  );

  return (
    <article
      className="group flex flex-col h-full animate-fade-in"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <button
        type="button"
        onClick={open}
        className="relative w-full aspect-[4/5] overflow-hidden text-left rounded-2xl bg-white"
        aria-label={`Ver detalhes de ${nome}`}
      >
        {badge && (
          <div className="absolute top-3 left-3 z-10">
            <span className="text-[10px] font-medium uppercase tracking-[0.22em] px-2.5 py-1 rounded-full bg-navy text-white">
              {badge}
            </span>
          </div>
        )}
        {primary && (
          <img
            src={primary}
            alt={nome}
            loading="lazy"
            className={cn(
              "absolute inset-0 w-full h-full object-cover transition-opacity duration-500",
              hovering && secondary && !selectedCor ? "opacity-0" : "opacity-100"
            )}
          />
        )}
        {secondary && !selectedCor && (
          <img
            src={secondary}
            alt={nome}
            loading="lazy"
            aria-hidden="true"
            className={cn(
              "absolute inset-0 w-full h-full object-cover transition-opacity duration-500 hidden md:block",
              hovering ? "opacity-100" : "opacity-0"
            )}
          />
        )}
      </button>

      <div className="mt-4 px-1">
        <button type="button" onClick={open} className="text-left w-full">
          <h3 className="font-normal text-navy leading-snug tracking-tight hover:text-green-cta transition-colors line-clamp-2 text-sm md:text-base">
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
