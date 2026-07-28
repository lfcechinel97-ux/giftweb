import { useEffect, useMemo, useState } from "react";
import { X, Minus, Plus, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatarBRL } from "@/utils/price";
import { useTopCart } from "@/contexts/TopProdutosCart";
import { useIsMobile } from "@/hooks/use-mobile";
import { TOPPRODUTOS_CATEGORIAS } from "@/hooks/useCuratedTopProdutos";
import type { CuratedProduct } from "@/hooks/useCuratedTopProdutos";
import { getCorHex } from "@/utils/colorHex";

const TIERS: Array<{ qty: number; discount: number }> = [
  { qty: 20, discount: 0 },
  { qty: 50, discount: 0.03 },
  { qty: 100, discount: 0.06 },
];

const isValidHex = (v?: string | null) =>
  !!v && /^#?[0-9a-fA-F]{3,8}$/.test(v.trim());
const normalizeHex = (v: string) => (v.trim().startsWith("#") ? v.trim() : `#${v.trim()}`);

interface Props {
  product: CuratedProduct | null;
  onClose: () => void;
}

const ACCENT = "hsl(var(--green-cta))"; // verde CTA — sem azul de destaque

// Detecta linhas "Rótulo: valor" para exibir em lista de duas colunas.
// Também quebra linhas separadas por "|" em itens independentes.
function parseSpecs(text: string): { label: string; value: string }[] | null {
  const parts = text
    .split(/\r?\n|\s*\|\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  const specs = parts
    .map((p) => {
      const idx = p.indexOf(":");
      if (idx <= 0) return null;
      return { label: p.slice(0, idx).trim(), value: p.slice(idx + 1).trim() };
    })
    .filter((x): x is { label: string; value: string } => !!x && !!x.value);
  return specs.length >= 2 ? specs : null;
}

const TopProductModal = ({ product, onClose }: Props) => {
  const isMobile = useIsMobile();
  const { addItem, getQty } = useTopCart();
  const [activeImg, setActiveImg] = useState(0);
  const [selectedCorIdx, setSelectedCorIdx] = useState<number | null>(null);
  const [qtd, setQtd] = useState(20);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    if (!product) return;
    setActiveImg(0);
    setSelectedCorIdx(null);
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

  const coresList = useMemo(
    () => (product?.cores ?? []).filter((c) => c && (c.nome || c.referencia)),
    [product?.id]
  );
  const swatchColor = (c: { nome?: string; referencia?: string | null }) =>
    isValidHex(c.referencia) ? normalizeHex(c.referencia!) : getCorHex(c.nome ?? "");

  const specs = useMemo(
    () => (product?.descricao_longa ? parseSpecs(product.descricao_longa) : null),
    [product?.descricao_longa]
  );

  if (!product) return null;

  const gallery = (product.image_urls?.filter(Boolean) as string[]) ?? [];
  const min = product.quantidade_minima ?? 20;
  const catLabel =
    TOPPRODUTOS_CATEGORIAS.find((c) => c.slug === product.categoria)?.label ?? product.categoria;
  const price = product.preco_final != null ? formatarBRL(product.preco_final) : "R$ --,--";

  const selectedCor = selectedCorIdx != null ? coresList[selectedCorIdx] : null;
  const mainImg = selectedCor?.imagem || gallery[activeImg] || product.image_url;

  const handleAdd = () => {
    const corNome = selectedCor?.nome;
    const cartId = corNome ? `${product.id}::${corNome}` : product.id;
    addItem(
      {
        id: cartId,
        produtoId: product.id,
        nome: product.nome,
        image: selectedCor?.imagem || product.image_url,
        preco: product.preco_final,
        categoria: catLabel,
        sku: product.codigo_amigavel,
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

        {/* Galeria */}
        <div className="md:w-3/5 bg-white flex flex-col">
          <div className="relative flex-1 aspect-square md:aspect-auto md:min-h-[500px] flex items-center justify-center">
            {mainImg ? (
              <img
                src={mainImg}
                alt={product.nome}
                className="max-w-full max-h-full object-contain p-4 md:p-6"
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
                  onClick={() => {
                    setActiveImg(i);
                    setSelectedCorIdx(null);
                  }}
                  className={cn(
                    "w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-white border-2 transition",
                    i === activeImg && !selectedCor
                      ? "border-[color:var(--acc)]"
                      : "border-transparent hover:border-slate-200"
                  )}
                  style={{ ["--acc" as any]: ACCENT }}
                >
                  <img src={src} alt="" className="w-full h-full object-contain p-1" />
                </button>
              ))}
            </div>
          )}
          {gallery.length > 1 && (
            <div className="md:hidden flex gap-2 p-3 border-t border-slate-100 overflow-x-auto">
              {gallery.map((src, i) => (
                <button
                  key={src + i}
                  type="button"
                  onClick={() => {
                    setActiveImg(i);
                    setSelectedCorIdx(null);
                  }}
                  className={cn(
                    "w-14 h-14 shrink-0 rounded-lg overflow-hidden bg-white border-2 transition",
                    i === activeImg && !selectedCor
                      ? "border-green-cta"
                      : "border-slate-200"
                  )}
                >
                  <img src={src} alt="" className="w-full h-full object-contain p-1" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="md:w-2/5 flex flex-col p-6 md:p-8 overflow-y-auto">
          <span
            className="text-[10px] font-medium uppercase tracking-widest mb-3 text-green-cta"
          >
            {catLabel}
          </span>
          <h2 className="text-2xl md:text-3xl font-light text-navy leading-tight tracking-tight">
            {product.nome}
          </h2>
          <div className="mt-4 flex items-end gap-3">
            <div className="flex flex-col leading-tight">
              <span className="text-[11px] uppercase tracking-[0.18em] text-slate-400 font-light">
                A partir de
              </span>
              <span className="text-3xl font-light text-navy tabular-nums">{price}</span>
            </div>
            <span className="text-xs font-light text-slate-400 uppercase tracking-widest pb-1">
              Mínimo {min} un
            </span>
          </div>

          {/* Seletor de cor */}
          {coresList.length > 1 && (
            <div className="mt-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] font-bold text-navy uppercase tracking-[0.18em]">
                  Cor:
                </span>
                <span className="text-xs text-slate-500">
                  {selectedCor?.nome ?? "Selecione uma cor"}
                </span>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {coresList.map((c, i) => {
                  const active = selectedCorIdx === i;
                  return (
                    <button
                      key={`${c.referencia ?? c.nome}-${i}`}
                      type="button"
                      onClick={() => setSelectedCorIdx(active ? null : i)}
                      title={c.nome}
                      aria-label={`Cor ${c.nome}`}
                      aria-pressed={active}
                      className={cn(
                        "relative w-10 h-10 rounded-full overflow-hidden transition-all",
                        active
                          ? "ring-2 ring-offset-2 scale-105"
                          : "ring-1 ring-slate-200 hover:ring-slate-400"
                      )}
                      style={
                        active
                          ? ({ ["--tw-ring-color" as any]: ACCENT } as React.CSSProperties)
                          : undefined
                      }
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
            </div>
          )}

          {/* Qtd + Adicionar — logo após as variações */}
          <div className="mt-6 space-y-3">
            <div className="flex items-center gap-4">
              <span className="text-xs font-medium text-navy uppercase tracking-widest">Qtd:</span>
              <div className="flex items-center gap-3 border border-slate-200 rounded-full px-2 h-11">
                <button
                  type="button"
                  onClick={() => setQtd((q) => Math.max(min, q - 5))}
                  aria-label="Diminuir 5"
                  className="w-8 h-8 flex items-center justify-center text-navy"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="text-sm font-medium text-navy tabular-nums min-w-[3ch] text-center">
                  {qtd}
                </span>
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

          {/* Especificações / Descrição — por último */}
          {specs ? (
            <div className="mt-6 border-t border-slate-100 pt-5">
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3">
                Especificações
              </span>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                {specs.map((s, i) => (
                  <div key={i} className="flex flex-col">
                    <dt className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em]">
                      {s.label}
                    </dt>
                    <dd className="text-sm text-navy leading-snug">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : (
            product.descricao_longa && (
              <p className="mt-6 text-slate-600 leading-relaxed text-sm md:text-base whitespace-pre-line">
                {product.descricao_longa}
              </p>
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default TopProductModal;
