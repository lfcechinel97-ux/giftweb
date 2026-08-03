import { useEffect, useMemo, useState } from "react";
import { X, Minus, Plus, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatarBRL, getEffectiveUnitPrice } from "@/utils/price";
import { getCorHex } from "@/utils/colorHex";
import { useTopCart } from "@/contexts/TopProdutosCart";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Top10Produto } from "@/hooks/useTop10Xbz";

const TIERS = [20, 50, 100];
const MIN = 20;

interface Props {
  product: (Top10Produto & { categoriaLabel?: string }) | null;
  onClose: () => void;
}

const Top10ProductModal = ({ product, onClose }: Props) => {
  const isMobile = useIsMobile();
  const { addItem, getQty } = useTopCart();
  const [activeImg, setActiveImg] = useState(0);
  const [corIdx, setCorIdx] = useState<number | null>(null);
  const [qtd, setQtd] = useState(MIN);
  const [added, setAdded] = useState(false);

  const productId = product?.id;

  useEffect(() => {
    setActiveImg(0);
    setCorIdx(null);
    setQtd(MIN);
    setAdded(false);
  }, [productId]);

  useEffect(() => {
    if (!product) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [product, onClose]);

  const coresList = useMemo(
    () => (product?.cores ?? []).filter((c) => !!c.nome),
    [product]
  );

  if (!product) return null;

  const gallery = product.image_urls ?? [];
  const selectedCor = corIdx != null ? coresList[corIdx] : null;
  const mainImg = selectedCor?.imagem || gallery[activeImg] || product.image_url;
  const unitPrice = (qty: number) =>
    product.preco_custo ? getEffectiveUnitPrice(product.tabela_precos, product.preco_custo, qty) : null;

  const handleAdd = () => {
    const corNome = selectedCor?.nome;
    addItem(
      {
        id: corNome ? `${product.id}::${corNome}` : product.id,
        produtoId: product.id,
        nome: product.nome,
        image: selectedCor?.imagem ?? product.image_url,
        preco: unitPrice(qtd),
        categoria: product.categoriaLabel,
        sku: selectedCor?.codigo_amigavel ?? product.codigo_amigavel,
        cor: corNome,
      },
      qtd
    );
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "bg-white w-full md:max-w-5xl md:rounded-2xl overflow-hidden shadow-2xl relative",
          "max-h-[95vh] md:max-h-[90vh] flex flex-col md:flex-row",
          isMobile ? "rounded-t-2xl animate-slide-up" : "animate-scale-in"
        )}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/90 hover:bg-white flex items-center justify-center shadow-md transition"
        >
          <X className="w-5 h-5 text-navy" />
        </button>

        <div className="md:w-3/5 bg-white flex flex-col">
          <div className="relative flex-1 aspect-square md:aspect-auto md:min-h-[500px] flex items-center justify-center">
            {mainImg ? (
              <img src={mainImg} alt={product.nome} className="max-w-full max-h-full object-contain p-4 md:p-6" />
            ) : (
              <div className="text-slate-300 text-sm">Sem imagem</div>
            )}
          </div>
          {gallery.length > 1 && (
            <div className="flex gap-2 md:gap-3 p-3 md:p-4 border-t border-slate-100 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {gallery.slice(0, 12).map((src, i) => (
                <button
                  key={src + i}
                  type="button"
                  onClick={() => {
                    setActiveImg(i);
                    setCorIdx(null);
                  }}
                  className={cn(
                    "w-14 h-14 md:w-16 md:h-16 shrink-0 rounded-lg overflow-hidden bg-white border-2 transition",
                    i === activeImg && !selectedCor ? "border-green-cta" : "border-slate-200 hover:border-navy/30"
                  )}
                >
                  <img src={src} alt="" className="w-full h-full object-contain p-1" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="md:w-2/5 flex flex-col p-6 md:p-8 overflow-y-auto">
          <h2 className="text-2xl md:text-3xl font-light text-navy leading-tight tracking-tight">
            {product.nome}
          </h2>
          <span className="mt-2 text-[11px] uppercase tracking-[0.2em] text-slate-400 font-light">
            SKU {product.codigo_amigavel}
          </span>

          <div className="mt-5 grid grid-cols-3 gap-2">
            {TIERS.map((q) => {
              const unit = unitPrice(q);
              const active = qtd === q;
              return (
                <button
                  key={q}
                  type="button"
                  onClick={() => setQtd(Math.max(MIN, q))}
                  className={cn(
                    "rounded-lg border px-2 py-2 text-center transition-colors",
                    active ? "border-green-cta bg-green-cta/5" : "border-slate-200 hover:border-navy/30"
                  )}
                >
                  <div className="text-[10px] font-normal text-slate-400 tracking-wide leading-tight">{q}+ un</div>
                  <div className="text-[13px] md:text-sm font-medium text-navy tabular-nums leading-tight whitespace-nowrap">
                    {unit != null ? formatarBRL(unit) : "—"}
                  </div>
                </button>
              );
            })}
          </div>
          <span className="mt-2 text-[11px] uppercase tracking-[0.18em] text-slate-400 font-light">
            Mínimo {MIN} un
          </span>

          {coresList.length > 1 && (
            <div className="mt-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] font-medium text-navy uppercase tracking-[0.18em]">Cor:</span>
                <span className="text-xs text-slate-500">{selectedCor?.nome ?? "Selecione uma cor"}</span>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {coresList.map((c, i) => {
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
                        "w-8 h-8 rounded-full transition-all",
                        active
                          ? "ring-2 ring-offset-2 ring-green-cta scale-110"
                          : "ring-1 ring-slate-200 hover:ring-navy/40"
                      )}
                    />
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-6 space-y-3">
            <div className="flex items-center gap-4">
              <span className="text-xs font-medium text-navy uppercase tracking-widest">Qtd:</span>
              <div className="flex items-center gap-3 border border-slate-200 rounded-full px-2 h-11">
                <button
                  type="button"
                  onClick={() => setQtd((q) => Math.max(MIN, q - 5))}
                  aria-label="Diminuir 5"
                  className="w-8 h-8 flex items-center justify-center text-navy"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="text-sm font-medium text-navy tabular-nums min-w-[3ch] text-center">{qtd}</span>
                <button
                  type="button"
                  onClick={() => setQtd((q) => q + 5)}
                  aria-label="Aumentar 5"
                  className="w-8 h-8 flex items-center justify-center text-green-cta"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleAdd}
              className={cn(
                "w-full h-12 rounded-full text-sm font-medium uppercase tracking-widest transition-all text-white bg-green-cta",
                added ? "brightness-95" : "hover:brightness-110"
              )}
            >
              {added ? (
                <span className="inline-flex items-center gap-2">
                  <Check className="w-4 h-4" /> Adicionado ao orçamento
                </span>
              ) : getQty(product.id) > 0 ? (
                "Atualizar no orçamento"
              ) : (
                "Adicionar ao orçamento"
              )}
            </button>
          </div>

          {product.descricao && (
            <p className="mt-6 text-slate-600 leading-relaxed text-sm md:text-base whitespace-pre-line border-t border-slate-100 pt-5">
              {product.descricao}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Top10ProductModal;
