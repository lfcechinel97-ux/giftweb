import { useState } from "react";
import { ShoppingCart, ArrowLeft, ShieldCheck } from "lucide-react";
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
      <header className="fixed top-0 left-0 right-0 z-50">
        {/* Barra principal */}
        <div className="bg-navy border-b border-white/[0.06]">
          <div className="container mx-auto px-4 sm:px-6 lg:px-12">
            <div className="flex items-center justify-between h-16 sm:h-20">
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
                  {/* Monograma */}
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
                  {/* Wordmark */}
                  <span className="flex flex-col leading-none min-w-0">
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
                    <span className="hidden sm:block mt-1.5 text-[10px] font-light tracking-[0.22em] uppercase text-white/50">
                      Corporativo · B2B
                    </span>
                  </span>
                </a>
              </div>

              <button
                type="button"
                className={cn(
                  "relative flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-full",
                  "bg-white/[0.06] text-white/90 hover:bg-white/[0.12] hover:text-white",
                  "transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-cta/60"
                )}
                aria-label="Carrinho"
              >
                <ShoppingCart className="w-5 h-5" strokeWidth={1.6} />
                {totalItems > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-green-cta text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-navy">
                    {totalItems}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Faixa informativa — minimalista, foco B2B */}
        <div className="bg-[#0a1428] border-b border-white/[0.04]">
          <div className="container mx-auto px-4 sm:px-6 lg:px-12 py-1.5 flex items-center justify-center gap-2 text-[10px] sm:text-[11px] text-white/60 font-light tracking-wider uppercase">
            <ShieldCheck className="w-3 h-3 text-green-cta" strokeWidth={2} />
            <span>Pedido mínimo</span>
            <span className="text-white/30">·</span>
            <span className="text-white/90 font-normal tracking-wide normal-case">R$ 500 ou 20 unidades por produto</span>
          </div>
        </div>
      </header>

      <main className="pt-[96px] sm:pt-[116px] pb-32">
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
