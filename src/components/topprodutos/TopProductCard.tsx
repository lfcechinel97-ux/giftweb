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

interface Props {
  product: TopProduct;
  minQuantidade?: number;
  onAdd?: (product: TopProduct, quantidade: number) => void;
}

const DEFAULT_MIN = 20;

const TopProductCard = ({ product, minQuantidade, onAdd }: Props) => {
  const { nome, image_url, image_urls, preco_custo, quantidade_minima, preco_final } = product;
  const min = quantidade_minima ?? minQuantidade ?? DEFAULT_MIN;

  const primary = image_url || (image_urls && image_urls[0]) || null;
  const secondary =
    image_urls?.find((u) => u && u !== primary) ||
    (image_urls && image_urls.length > 1 ? image_urls[1] : null);

  const [hovering, setHovering] = useState(false);
  const [adding, setAdding] = useState(false);
  const [qtd, setQtd] = useState(min);

  const precoUnit = preco_final != null ? preco_final : (preco_custo != null ? calcularPreco(preco_custo, min) : null);


  const handleAdd = () => {
    setAdding(true);
    onAdd?.(product, qtd);
  };

  const dec = () => setQtd((q) => Math.max(min, q - 1));
  const inc = () => setQtd((q) => q + 1);

  return (
    <article
      className={cn(
        "group flex flex-col rounded-[12px] bg-card overflow-hidden",
        "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_1px_3px_rgba(15,23,42,0.06)]",
        "hover:shadow-[0_4px_12px_rgba(15,23,42,0.08),0_2px_4px_rgba(15,23,42,0.06)]",
        "transition-shadow duration-200"
      )}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {/* Imagem */}
      <div className="relative aspect-square w-full bg-muted/30 overflow-hidden">
        {primary && (
          <img
            src={primary}
            alt={nome}
            loading="lazy"
            width={600}
            height={600}
            className={cn(
              "absolute inset-0 w-full h-full object-contain p-4 transition-opacity duration-200",
              hovering && secondary ? "opacity-0" : "opacity-100"
            )}
          />
        )}
        {secondary && (
          <img
            src={secondary}
            alt={nome}
            loading="lazy"
            width={600}
            height={600}
            aria-hidden="true"
            className={cn(
              "absolute inset-0 w-full h-full object-contain p-4 transition-opacity duration-200 hidden md:block",
              hovering ? "opacity-100" : "opacity-0"
            )}
          />
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col gap-1.5 p-4">
        <h3 className="text-sm font-semibold text-foreground line-clamp-2 min-h-[2.5rem] leading-tight">
          {nome}
        </h3>

        {precoUnit != null && (
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-bold text-navy">
              {formatarBRL(precoUnit)}
            </span>
            <span className="text-[11px] text-muted-foreground">/un</span>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground">
          Pedido mínimo: {min} un
        </p>

        {/* Botão / seletor */}
        <div className="mt-3">
          {!adding ? (
            <button
              type="button"
              onClick={handleAdd}
              className={cn(
                "w-full h-10 rounded-[10px] bg-green-cta text-white text-sm font-semibold",
                "hover:brightness-110 active:scale-[0.98] transition-all duration-150",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-green-cta/60"
              )}
            >
              Adicionar
            </button>
          ) : (
            <div className="flex items-center justify-between h-10 rounded-[10px] border border-border bg-background overflow-hidden">
              <button
                type="button"
                onClick={dec}
                aria-label="Diminuir"
                className="w-10 h-full flex items-center justify-center text-foreground hover:bg-muted transition-colors"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="text-sm font-semibold text-foreground tabular-nums">
                {qtd}
              </span>
              <button
                type="button"
                onClick={inc}
                aria-label="Aumentar"
                className="w-10 h-full flex items-center justify-center text-green-cta hover:bg-muted transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
};

export default TopProductCard;
