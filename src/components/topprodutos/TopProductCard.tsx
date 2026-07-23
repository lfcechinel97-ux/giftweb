import { useState } from "react";
import { Minus, Plus } from "lucide-react";
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
}

export type TopProductVariant = "hero" | "side" | "grid";

interface Props {
  product: TopProduct;
  minQuantidade?: number;
  onAdd?: (product: TopProduct, quantidade: number) => void;
  onOpen?: (product: TopProduct) => void;
  variant?: TopProductVariant;
  eyebrow?: string;
  badge?: string;
}

const DEFAULT_MIN = 20;

const ASPECT: Record<TopProductVariant, string> = {
  hero: "aspect-[16/9]",
  side: "aspect-square",
  grid: "aspect-[3/4]",
};

const TopProductCard = ({ product, minQuantidade, onAdd, onOpen, variant = "grid", eyebrow, badge }: Props) => {
  const { nome, image_url, image_urls, preco_custo, quantidade_minima, preco_final } = product;
  const min = quantidade_minima ?? minQuantidade ?? DEFAULT_MIN;

  const primary = image_url || (image_urls && image_urls[0]) || null;
  const secondary =
    image_urls?.find((u) => u && u !== primary) ||
    (image_urls && image_urls.length > 1 ? image_urls[1] : null);

  const [hovering, setHovering] = useState(false);
  const [adding, setAdding] = useState(false);
  const [qtd, setQtd] = useState(min);

  const precoUnit =
    preco_final != null ? preco_final : preco_custo != null ? calcularPreco(preco_custo, min) : null;
  const precoFmt = precoUnit != null ? formatarBRL(precoUnit) : "R$ --,--";

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    setAdding(true);
    onAdd?.(product, qtd);
  };
  const dec = (e: React.MouseEvent) => { e.stopPropagation(); setQtd((q) => Math.max(min, q - 1)); };
  const inc = (e: React.MouseEvent) => { e.stopPropagation(); setQtd((q) => q + 1); };
  const open = () => onOpen?.(product);

  return (
    <article
      className="group flex flex-col animate-fade-in"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {/* Imagem — clicável para abrir detalhes */}
      <button
        type="button"
        onClick={open}
        className={cn("relative w-full overflow-hidden bg-slate-100 cursor-pointer text-left", ASPECT[variant])}
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

      {/* Info */}
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

      {/* Ação */}
      <div className="mt-4">
        {!adding ? (
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
        ) : (
          <div className="inline-flex items-center gap-3 h-9 px-1 border-b border-navy/30">
            <button
              type="button"
              onClick={dec}
              aria-label="Diminuir"
              className="w-7 h-7 flex items-center justify-center text-navy hover:text-green-cta transition-colors"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span className="text-sm font-bold text-navy tabular-nums min-w-[2ch] text-center">
              {qtd}
            </span>
            <button
              type="button"
              onClick={inc}
              aria-label="Aumentar"
              className="w-7 h-7 flex items-center justify-center text-green-cta hover:brightness-110 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </article>
  );
};

export default TopProductCard;
