import { useState } from "react";
import { ShoppingCart, ArrowLeft, ShieldCheck, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import MaisVendidosSection from "@/components/topprodutos/MaisVendidosSection";
import CategoriasGrid from "@/components/topprodutos/CategoriasGrid";
import CategoriasHomeGrid from "@/components/topprodutos/CategoriasHomeGrid";
import TopProductModal from "@/components/topprodutos/TopProductModal";
import TopCartBar from "@/components/topprodutos/TopCartBar";
import { TutorialModal, TutorialHelpButton } from "@/components/topprodutos/TutorialModal";
import { TopProdutosCartProvider, useTopCart } from "@/contexts/TopProdutosCart";
import { useCuratedTopProdutos, TOPPRODUTOS_CATEGORIAS } from "@/hooks/useCuratedTopProdutos";
import type { CuratedProduct } from "@/hooks/useCuratedTopProdutos";
import type { TopProduct } from "@/components/topprodutos/TopProductCard";

type View = { kind: "home" } | { kind: "all" } | { kind: "category"; slug: string };

const TopProdutosInner = () => {
  const { data } = useCuratedTopProdutos();
  const { addItem, totalItems } = useTopCart();
  const [openId, setOpenId] = useState<string | null>(null);
  const [view, setView] = useState<View>({ kind: "home" });

  const openProduct: CuratedProduct | null =
    (data ?? []).find((p) => p.id === openId) ?? null;

  const goHome = () => {
    setView({ kind: "home" });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const goAll = () => {
    setView({ kind: "all" });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const goCategory = (slug: string) => {
    setView({ kind: "category", slug });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleAdd = (
    product: TopProduct,
    quantidade: number,
    extras?: { sku?: string; cor?: string; image?: string | null }
  ) => {
    const full = (data ?? []).find((p) => p.id === product.id);
    const catLabel = full
      ? TOPPRODUTOS_CATEGORIAS.find((c) => c.slug === full.categoria)?.label ?? full.categoria
      : undefined;
    const cor = extras?.cor;
    const cartId = cor ? `${product.id}::${cor}` : product.id;
    addItem(
      {
        id: cartId,
        produtoId: product.id,
        nome: product.nome,
        image: extras?.image ?? product.image_url,
        preco: product.preco_final ?? null,
        categoria: catLabel,
        sku: extras?.sku ?? product.codigo_amigavel,
        cor,
      },
      quantidade
    );
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="fixed top-0 left-0 right-0 z-50">
        {/* Barra principal */}
        <div className="bg-navy border-b border-white/[0.06]">
          <div className="container mx-auto px-4 sm:px-6 lg:px-12">
            <div className="grid grid-cols-[auto_1fr_auto] items-center h-16 sm:h-20 gap-3">
              {/* Esquerda: back + logo */}
              <div className="flex items-center gap-3 min-w-0">
                {view.kind !== "home" && (
                  <button
                    type="button"
                    onClick={goHome}
                    aria-label="Voltar às categorias"
                    className="flex items-center justify-center w-9 h-9 rounded-full bg-white/[0.06] text-white/80 hover:bg-white/[0.12] hover:text-white transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                )}
                <a
                  href="/"
                  className="group flex items-center gap-3 select-none min-w-0"
                  aria-label="Gift Web Brindes"
                >
                  <span
                    className="relative flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-green-cta to-emerald-600 shadow-[0_6px_20px_-6px_rgba(34,197,94,0.6)]"
                    aria-hidden="true"
                  >
                    <span
                      className="text-white text-lg sm:text-xl font-black italic tracking-tight"
                      style={{ fontFamily: "'Georgia', serif" }}
                    >
                      G
                    </span>
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-white ring-2 ring-navy" />
                  </span>
                  <span className="hidden sm:flex flex-col leading-none min-w-0">
                    <span className="flex items-baseline gap-1.5">
                      <span
                        className="text-lg sm:text-2xl font-black italic text-white tracking-tight"
                        style={{ fontFamily: "'Georgia', serif" }}
                      >
                        Gift Web
                      </span>
                      <span className="text-[9px] sm:text-[10px] font-semibold text-green-cta tracking-[0.28em] uppercase">
                        Brindes
                      </span>
                    </span>
                    <span className="mt-1.5 text-[10px] font-light tracking-[0.22em] uppercase text-white/50">
                      Corporativo · B2B
                    </span>
                  </span>
                </a>
              </div>

              {/* Centro: Top Vendas 2026 */}
              <div className="flex items-center justify-center min-w-0">
                <div className="inline-flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-1.5 sm:py-2 rounded-full bg-white/[0.05] border border-white/10">
                  <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-cta" strokeWidth={2} />
                  <span
                    className="text-white tracking-[0.28em] uppercase font-semibold text-[10px] sm:text-xs whitespace-nowrap"
                    style={{ fontFamily: "'Georgia', serif", fontStyle: "italic", letterSpacing: "0.18em" }}
                  >
                    Top Vendas <span className="text-green-cta not-italic font-black">2026</span>
                  </span>
                </div>
              </div>

              {/* Direita: carrinho — apenas ícone, maior e mais clean */}
              <button
                type="button"
                onClick={() => window.dispatchEvent(new Event("topprodutos:open-cart"))}
                className={cn(
                  "relative inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-full",
                  "bg-green-cta text-white",
                  "shadow-[0_8px_24px_-8px_rgba(34,197,94,0.7)] hover:brightness-110 active:scale-95",
                  "transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-green-cta/60"
                )}
                aria-label={`Ver carrinho${totalItems > 0 ? ` com ${totalItems} ${totalItems === 1 ? "item" : "itens"}` : ""}`}
              >
                <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2} />
                {totalItems > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1 rounded-full bg-white text-navy text-[11px] font-black flex items-center justify-center ring-2 ring-navy">
                    {totalItems}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Faixa de pedido mínimo — mais visível */}
        <div className="bg-white border-b border-slate-200">
          <div className="container mx-auto px-4 sm:px-6 lg:px-12 py-2.5 sm:py-3 flex items-center justify-center gap-3 text-center">
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-green-cta/10">
              <ShieldCheck className="w-4 h-4 text-green-cta" strokeWidth={2.2} />
            </span>
            <div className="flex flex-wrap items-baseline justify-center gap-x-2 gap-y-0.5">
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.22em] text-navy">
                Pedido mínimo
              </span>
              <span className="text-sm sm:text-base font-semibold text-navy">
                R$ 500 <span className="text-slate-400 font-normal">ou</span> 20 unidades por produto
              </span>
            </div>
          </div>
        </div>
      </header>


      <main className="pt-[120px] sm:pt-[140px] pb-32">
        {view.kind === "home" && (
          <section className="pt-10 md:pt-20 pb-24 md:pb-32">
            <CategoriasHomeGrid onSelectCategory={goCategory} onSelectAll={goAll} />
          </section>
        )}

        {view.kind === "all" && (
          <>
            <section className="pt-10 md:pt-16 pb-16 md:pb-24">
              <MaisVendidosSection onAdd={handleAdd} onOpen={(p) => setOpenId(p.id)} />
            </section>
            <section className="pb-24 md:pb-32">
              <CategoriasGrid
                active="__all__"
                onBack={goHome}
                onAdd={handleAdd}
                onOpen={(p) => setOpenId(p.id)}
              />
            </section>
          </>
        )}

        {view.kind === "category" && (
          <section className="pt-8 md:pt-14 pb-24 md:pb-32">
            <CategoriasGrid
              active={view.slug}
              onBack={goHome}
              onAdd={handleAdd}
              onOpen={(p) => setOpenId(p.id)}
            />
          </section>
        )}
      </main>

      <TopProductModal product={openProduct} onClose={() => setOpenId(null)} />
      <TopCartBar />
      <TutorialHelpButton />
      <TutorialModal />
    </div>
  );
};

const TopProdutos = () => (
  <TopProdutosCartProvider>
    <TopProdutosInner />
  </TopProdutosCartProvider>
);

export default TopProdutos;
