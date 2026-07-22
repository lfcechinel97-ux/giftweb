import { useState } from "react";
import { ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import TopProductCard from "@/components/topprodutos/TopProductCard";
import { useTopProdutos } from "@/hooks/useTopProdutos";

const TopProdutos = () => {
  const [cartCount, setCartCount] = useState(0);
  const { data: produtos, isLoading } = useTopProdutos(3);

  return (
    <div className="min-h-screen bg-background">
      {/* Header fixo simples */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-navy border-b border-white/5">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <a
              href="/"
              className="flex items-baseline gap-1 select-none"
              aria-label="Gift Web Brindes"
            >
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
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-green-cta text-white text-[10px] font-bold flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="pt-14 sm:pt-16">
        <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-foreground tracking-tight">
              Top Produtos
            </h1>
            <p className="mt-4 text-base sm:text-lg text-muted-foreground">
              Os brindes corporativos mais pedidos, prontos pra você adicionar.
            </p>
          </div>

          <div className="mt-12 sm:mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 max-w-5xl mx-auto">
            {isLoading &&
              Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-[4/5] rounded-[12px] bg-muted/40 animate-pulse"
                />
              ))}

            {!isLoading &&
              produtos?.map((p) => (
                <TopProductCard
                  key={p.id}
                  product={p}
                  onAdd={() => setCartCount((c) => c + 1)}
                />
              ))}
          </div>
        </section>
      </main>
    </div>
  );
};

export default TopProdutos;
