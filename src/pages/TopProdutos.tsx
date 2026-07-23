import { useState } from "react";
import { ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import MaisVendidosSection from "@/components/topprodutos/MaisVendidosSection";
import CategoriasGrid from "@/components/topprodutos/CategoriasGrid";
import TopProductModal from "@/components/topprodutos/TopProductModal";
import TopCartBar from "@/components/topprodutos/TopCartBar";
import { TopProdutosCartProvider, useTopCart } from "@/contexts/TopProdutosCart";
import { useCuratedTopProdutos, TOPPRODUTOS_CATEGORIAS } from "@/hooks/useCuratedTopProdutos";
import type { CuratedProduct } from "@/hooks/useCuratedTopProdutos";
import type { TopProduct } from "@/components/topprodutos/TopProductCard";

const TopProdutosInner = () => {
  const { data } = useCuratedTopProdutos();
  const { addItem, totalItems } = useTopCart();
  const [openId, setOpenId] = useState<string | null>(null);

  const openProduct: CuratedProduct | null =
    (data ?? []).find((p) => p.id === openId) ?? null;

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
    <div className="min-h-screen bg-[#f8fafc]">
      <header className="fixed top-0 left-0 right-0 z-50 bg-navy border-b border-white/5">
        <div className="container mx-auto px-4 sm:px-6 lg:px-12">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <a href="/" className="flex items-baseline gap-1 select-none" aria-label="Gift Web Brindes">
              <span
                className="text-xl sm:text-2xl font-black italic text-white tracking-tight"
                style={{ fontFamily: "'Georgia', serif" }}
              >
                Gift Web
              </span>
              <span className="text-[10px] sm:text-xs font-semibold text-green-cta tracking-[0.15em] uppercase">
                BRINDES
              </span>
            </a>

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
      </header>

      <main className="pt-14 sm:pt-16 pb-32">
        <section className="pt-16 md:pt-24 pb-24 md:pb-32">
          <MaisVendidosSection onAdd={handleAdd} onOpen={(p) => setOpenId(p.id)} />
        </section>

        <section className="pb-24 md:pb-32">
          <CategoriasGrid onAdd={handleAdd} onOpen={(p) => setOpenId(p.id)} />
        </section>
      </main>

      <TopProductModal product={openProduct} onClose={() => setOpenId(null)} />
      <TopCartBar />
    </div>
  );
};

const TopProdutos = () => (
  <TopProdutosCartProvider>
    <TopProdutosInner />
  </TopProdutosCartProvider>
);

export default TopProdutos;
