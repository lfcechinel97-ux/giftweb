import { useState } from "react";
import { ShoppingCart, ArrowLeft, Zap, Package } from "lucide-react";
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

  const handleAdd = (product: TopProduct, quantidade: number) => {
    const full = (data ?? []).find((p) => p.id === product.id);
    const catLabel = full
      ? TOPPRODUTOS_CATEGORIAS.find((c) => c.slug === full.categoria)?.label ?? full.categoria
      : undefined;
    addItem(
      {
        id: product.id,
        nome: product.nome,
        image: product.image_url,
        preco: product.preco_final ?? null,
        categoria: catLabel,
      },
      quantidade
    );
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="fixed top-0 left-0 right-0 z-50 bg-navy border-b border-white/5">
        <div className="container mx-auto px-4 sm:px-6 lg:px-12">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center gap-3 min-w-0">
              {view.kind !== "home" && (
                <button
                  type="button"
                  onClick={goHome}
                  aria-label="Voltar às categorias"
                  className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/[0.06] text-white/90 hover:bg-white/[0.10] hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
              <a href="/" className="flex items-baseline gap-1 select-none min-w-0" aria-label="Gift Web Brindes">
                <span
                  className="text-xl sm:text-2xl font-black italic text-white tracking-tight truncate"
                  style={{ fontFamily: "'Georgia', serif" }}
                >
                  Gift Web
                </span>
                <span className="text-[10px] sm:text-xs font-semibold text-green-cta tracking-[0.15em] uppercase">
                  BRINDES
                </span>
              </a>
            </div>

            <button
              type="button"
              className={cn(
                "relative flex items-center justify-center w-10 h-10 rounded-xl",
                "bg-white/[0.06] text-white/90 hover:bg-white/[0.10] hover:text-white",
                "transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-cta/60"
              )}
              aria-label="Carrinho"
            >
              <ShoppingCart className="w-5 h-5" />
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-green-cta text-white text-[10px] font-bold flex items-center justify-center">
                  {totalItems}
                </span>
              )}
            </button>
          </div>
        </div>
        {/* Faixa de regras comerciais — sempre visível */}
        <div className="bg-navy-dark/40 border-t border-white/5">
          <div className="container mx-auto px-4 sm:px-6 lg:px-12 py-2 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-[11px] sm:text-xs text-white/80 font-light tracking-wide">
            <span className="inline-flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-green-cta" />
              Pedido mínimo: <span className="text-white font-normal">R$ 500 ou 20 unidades</span>
            </span>
            <span className="hidden sm:inline text-white/20">•</span>
            <span className="inline-flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-green-cta" />
              Produção expressa: <span className="text-white font-normal">até 24h</span>
            </span>
          </div>
        </div>
      </header>

      <main className="pt-[92px] sm:pt-[100px] pb-32">
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
