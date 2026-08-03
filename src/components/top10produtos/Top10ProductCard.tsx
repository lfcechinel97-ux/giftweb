import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatarBRL, getEffectiveUnitPrice } from "@/utils/price";
import { getCorHex } from "@/utils/colorHex";
import type { Top10Produto } from "@/hooks/useTop10Xbz";

export interface Top10AddExtras {
  sku?: string;
  cor?: string;
  image?: string | null;
  preco?: number | null;
}

interface Props {
  product: Top10Produto;
  rank: number;
  onAdd?: (product: Top10Produto, quantidade: number, extras: Top10AddExtras) => void;
  onOpen?: (product: Top10Produto) => void;
}

const MIN = 20;
const STEP = 5;
const TIERS = [20, 50, 100];

const Top10ProductCard = ({ product, rank, onAdd, onOpen }: Props) => {
  const { nome, image_urls, cores, preco_custo, tabela_precos } = product;
  const [qtd, setQtd] = useState(MIN);
  const [corIdx, setCorIdx] = useState<number | null>(null);

  const coresList = (cores ?? []).filter((c) => !!c.nome);
  const selectedCor = corIdx != null ? coresList[corIdx] : null;

  const primary = selectedCor?.imagem || product.image_url || image_urls[0] || null;
  const secondary = image_urls.find((u) => u && u !== primary) ?? null;

  const unitPrice = (qty: number) =>
    preco_custo ? getEffectiveUnitPrice(tabela_precos, preco_custo, qty) : null;

  const open = () => onOpen?.(product);

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAdd?.(product, qtd, {
      sku: selectedCor?.codigo_amigavel ?? product.codigo_amigavel,
      cor: selectedCor?.nome,
      image: selectedCor?.imagem ?? product.image_url,
      preco: unitPrice(qtd),
    });
  };

  return (
    <article className="group flex flex-col h-full animate-fade-in">
      <button
        type="button"
        onClick={open}
        className="relative w-full aspect-[4/5] overflow-hidden text-left rounded-xl md:rounded-2xl bg-white border border-slate-100"
        aria-label={`Ver detalhes de ${nome}`}
      >
        <span className="absolute top-2 left-2 md:top-3 md:left-3 z-10 inline-flex items-center justify-center min-w-[26px] h-[26px] px-2 rounded-full bg-navy text-white text-[11px] font-medium tabular-nums">
          {rank}º
        </span>
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
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            className="absolute inset-0 w-full h-full object-contain p-3 sm:p-6 transition-opacity duration-500 hidden md:block opacity-0 md:group-hover:opacity-100"
          />
        )}
      </button>

      <div className="mt-3 md:mt-4 px-0.5 md:px-1 flex flex-col flex-1">
        <button type="button" onClick={open} className="text-left w-full">
          <h3 className="font-normal text-navy leading-snug tracking-tight hover:text-green-cta transition-colors line-clamp-2 text-[13px] md:text-base">
            {nome}
          </h3>
        </button>
        <span className="mt-1 block text-[10px] uppercase tracking-[0.18em] text-slate-400 font-light">
          SKU {product.codigo_amigavel}
        </span>

        {coresList.length > 1 && (
          <div className="flex flex-wrap items-center gap-1 md:gap-2 mt-2 md:mt-2.5">
            {coresList.slice(0, 10).map((c, i) => {
              const active = corIdx === i;
              return (
                <button
                  key={`${c.nome}-${i}`}
                  type="button"
                  onClick={() => setCorIdx(active ? null : i)}
                  title={c.nome}
                  aria-label={`Cor ${c.nome}`}
                  aria-pressed={active}
                  style={{ background: getCorHex(c.nome) }}
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
        )}

        <div className="grid grid-cols-3 gap-1 md:gap-2 mt-2 md:mt-2.5">
          {TIERS.map((q) => {
            const unit = unitPrice(q);
            const active = qtd === q;
            return (
              <button
                key={q}
                type="button"
                onClick={() => setQtd(Math.max(MIN, q))}
                className={cn(
                  "rounded md:rounded-lg border px-0.5 md:px-2 py-0.5 md:py-1.5 text-center transition-colors min-w-0",
                  active ? "border-green-cta bg-green-cta/5" : "border-slate-200 hover:border-navy/30"
                )}
              >
                <div className="text-[8px] md:text-[10px] font-normal text-slate-400 tracking-wide leading-tight">
                  {q} un
                </div>
                <div className="text-[10px] md:text-[13px] font-medium text-navy tabular-nums leading-tight whitespace-nowrap">
                  {unit != null ? formatarBRL(unit) : "—"}
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col xl:flex-row items-stretch gap-2 mt-3 md:mt-4">
          <div className="flex items-center justify-between md:justify-start border border-slate-200 rounded-full h-9 md:h-10 px-1 shrink-0">
            <button
              type="button"
              onClick={() => setQtd((q) => Math.max(MIN, q - STEP))}
              aria-label={`Diminuir ${STEP}`}
              className="w-8 h-8 flex items-center justify-center text-navy/70 hover:text-navy"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-medium text-navy tabular-nums min-w-[3ch] text-center">{qtd}</span>
            <button
              type="button"
              onClick={() => setQtd((q) => q + STEP)}
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
      </div>
    </article>
  );
};

export default Top10ProductCard;
