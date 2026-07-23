import { useEffect, useState } from "react";
import { X, Minus, Plus, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatarBRL } from "@/utils/price";
import { useTopCart } from "@/contexts/TopProdutosCart";
import { useIsMobile } from "@/hooks/use-mobile";
import { TOPPRODUTOS_CATEGORIAS } from "@/hooks/useCuratedTopProdutos";
import type { CuratedProduct } from "@/hooks/useCuratedTopProdutos";

interface Props {
  product: CuratedProduct | null;
  onClose: () => void;
}

const TopProductModal = ({ product, onClose }: Props) => {
  const isMobile = useIsMobile();
  const { addItem, getQty } = useTopCart();
  const [activeImg, setActiveImg] = useState(0);
  const [qtd, setQtd] = useState(20);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (!product) return;
    setActiveImg(0);
    const existing = getQty(product.id);
    setQtd(existing > 0 ? existing : product.quantidade_minima ?? 20);
    setAdded(false);
  }, [product?.id]);

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

  if (!product) return null;

  const gallery = (product.image_urls?.filter(Boolean) as string[]) ?? [];
  const min = product.quantidade_minima ?? 20;
  const catLabel = TOPPRODUTOS_CATEGORIAS.find((c) => c.slug === product.categoria)?.label ?? product.categoria;
  const price = product.preco_final != null ? formatarBRL(product.preco_final) : "R$ --,--";

  const handleAdd = () => {
    addItem(
      {
        id: product.id,
        nome: product.nome,
        image: product.image_url,
        preco: product.preco_final,
        categoria: catLabel,
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

        {/* Galeria */}
        <div className="md:w-3/5 bg-slate-50 flex flex-col">
          <div className="relative flex-1 aspect-square md:aspect-auto md:min-h-[500px] flex items-center justify-center">
            {gallery[activeImg] ? (
              <img
                src={gallery[activeImg]}
                alt={product.nome}
                className="max-w-full max-h-full object-contain p-8"
              />
            ) : (
              <div className="text-slate-300 text-sm">Sem imagem</div>
            )}
          </div>
          {gallery.length > 1 && (
            <div className="hidden md:flex gap-3 p-4 border-t border-slate-100 overflow-x-auto">
              {gallery.map((src, i) => (
                <button
                  key={src + i}
                  type="button"
                  onClick={() => setActiveImg(i)}
                  className={cn(
                    "w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-white border-2 transition",
                    i === activeImg ? "border-green-cta" : "border-transparent hover:border-slate-200"
                  )}
                >
                  <img src={src} alt="" className="w-full h-full object-contain p-1" />
                </button>
              ))}
            </div>
          )}
          {gallery.length > 1 && (
            <div className="md:hidden flex gap-2 justify-center p-3 border-t border-slate-100">
              {gallery.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveImg(i)}
                  aria-label={`Imagem ${i + 1}`}
                  className={cn(
                    "w-2 h-2 rounded-full transition",
                    i === activeImg ? "bg-navy w-6" : "bg-slate-300"
                  )}
                />
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="md:w-2/5 flex flex-col p-6 md:p-8 overflow-y-auto">
          <span className="text-[10px] font-bold text-green-cta uppercase tracking-widest mb-3">
            {catLabel}
          </span>
          <h2 className="text-2xl md:text-3xl font-bold text-navy leading-tight tracking-tight">
            {product.nome}
          </h2>
          <div className="mt-4 flex items-baseline gap-3">
            <span className="text-3xl font-light text-navy">{price}</span>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              MOQ: {min} un
            </span>
          </div>

          {product.descricao_longa && (
            <p className="mt-6 text-slate-600 leading-relaxed text-sm md:text-base whitespace-pre-line">
              {product.descricao_longa}
            </p>
          )}

          <div className="mt-auto pt-8 space-y-4">
            <div className="flex items-center gap-4">
              <span className="text-xs font-bold text-navy uppercase tracking-widest">Qtd:</span>
              <div className="flex items-center gap-3 border border-slate-200 rounded-full px-2 h-11">
                <button
                  type="button"
                  onClick={() => setQtd((q) => Math.max(min, q - 1))}
                  aria-label="Diminuir"
                  className="w-8 h-8 flex items-center justify-center text-navy hover:text-green-cta"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="text-sm font-bold text-navy tabular-nums min-w-[3ch] text-center">
                  {qtd}
                </span>
                <button
                  type="button"
                  onClick={() => setQtd((q) => q + 1)}
                  aria-label="Aumentar"
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
                "w-full h-12 rounded-full text-sm font-bold uppercase tracking-widest transition-all",
                added
                  ? "bg-green-cta text-white"
                  : "bg-navy text-white hover:bg-navy/90"
              )}
            >
              {added ? (
                <span className="inline-flex items-center gap-2">
                  <Check className="w-4 h-4" /> Adicionado
                </span>
              ) : getQty(product.id) > 0 ? (
                "Atualizar no pedido"
              ) : (
                "Adicionar ao pedido"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TopProductModal;
