import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ShoppingCart, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { TopProdutosCartProvider, useTopCart } from "@/contexts/TopProdutosCart";
import TopCartBar from "@/components/topprodutos/TopCartBar";
import Top10ProductCard, { type Top10AddExtras } from "@/components/top10produtos/Top10ProductCard";
import Top10ProductModal from "@/components/top10produtos/Top10ProductModal";
import { useTop10Xbz, type Top10Produto } from "@/hooks/useTop10Xbz";


const Top10Inner = () => {
  const { data, isLoading } = useTop10Xbz();
  const { addItem, totalItems } = useTopCart();
  const [openId, setOpenId] = useState<string | null>(null);
  const [activeCat, setActiveCat] = useState<string | null>(null);

  const secoes = data ?? [];

  const categorias = useMemo(
    () => secoes.flatMap((s) => s.categorias),
    [secoes]
  );

  const visiveis = activeCat ? categorias.filter((c) => c.slug === activeCat) : categorias;

  const openProduct = useMemo(() => {
    for (const c of categorias) {
      const p = c.produtos.find((x) => x.id === openId);
      if (p) return { ...p, categoriaLabel: c.label };
    }
    return null;
  }, [categorias, openId]);

  const handleAdd = (product: Top10Produto, quantidade: number, extras: Top10AddExtras) => {
    const cor = extras.cor;
    addItem(
      {
        id: cor ? `${product.id}::${cor}` : product.id,
        produtoId: product.id,
        nome: product.nome,
        image: extras.image ?? product.image_url,
        preco: extras.preco ?? null,
        sku: extras.sku ?? product.codigo_amigavel,
        cor,
      },
      quantidade
    );
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-50 bg-navy border-b border-white/[0.06]">
        <div className="container mx-auto px-4 sm:px-6 lg:px-12">
          <div className="flex items-center justify-between h-16 sm:h-20 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {activeCat && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveCat(null);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  aria-label="Voltar"
                  className="flex items-center justify-center w-9 h-9 rounded-full bg-white/[0.06] text-white/80 hover:bg-white/[0.12] transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}
              <Link to="/" className="shrink-0">
                <img src={logo} alt="Gift Web Brindes" className="h-7 sm:h-9 w-auto object-contain" />
              </Link>
            </div>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event("topprodutos:open-cart"))}
              className="relative flex items-center gap-2 h-10 px-4 rounded-full bg-white/[0.08] text-white text-xs font-medium hover:bg-white/[0.14] transition-colors"
            >
              <ShoppingCart className="w-4 h-4" />
              <span className="hidden sm:inline">Orçamento</span>
              {totalItems > 0 && (
                <span className="min-w-[20px] h-5 px-1 rounded-full bg-green-cta text-white text-[11px] font-semibold flex items-center justify-center">
                  {totalItems}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 lg:px-12">
        <section className="pt-10 md:pt-16 pb-6 md:pb-10 text-center">
          <span className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-green-cta font-medium">
            <Trophy className="w-3.5 h-3.5" /> Ranking XBZ
          </span>
          <h1 className="mt-3 text-3xl md:text-5xl font-light text-navy tracking-tight">
            Top 10 produtos por categoria
          </h1>
          <p className="mt-3 text-sm md:text-base text-slate-500 font-light max-w-2xl mx-auto">
            Os brindes mais vendidos de cada linha, ordenados por volume. Pedido mínimo de 20 unidades ou R$ 500 por produto.
          </p>
        </section>

        {categorias.length > 0 && (
          <nav className="flex gap-2 overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={() => setActiveCat(null)}
              className={cn(
                "shrink-0 h-9 px-4 rounded-full text-xs font-medium transition-colors border",
                !activeCat ? "bg-navy text-white border-navy" : "border-slate-200 text-navy hover:border-navy/40"
              )}
            >
              Todas
            </button>
            {categorias.map((c) => (
              <button
                key={c.slug}
                type="button"
                onClick={() => {
                  setActiveCat(c.slug);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className={cn(
                  "shrink-0 h-9 px-4 rounded-full text-xs font-medium transition-colors border whitespace-nowrap",
                  activeCat === c.slug
                    ? "bg-navy text-white border-navy"
                    : "border-slate-200 text-navy hover:border-navy/40"
                )}
              >
                {c.label}
              </button>
            ))}
          </nav>
        )}

        {isLoading && (
          <div className="py-24 text-center text-sm text-slate-400 font-light">Carregando ranking…</div>
        )}

        {!isLoading && categorias.length === 0 && (
          <div className="py-24 text-center text-sm text-slate-400 font-light">
            Nenhum produto disponível no momento.
          </div>
        )}

        {visiveis.map((cat) => (
          <section key={cat.slug} className="pb-12 md:pb-16">
            <div className="flex items-baseline justify-between gap-4 border-b border-slate-100 pb-3 mb-6">
              <div>
                <span className="block text-[10px] uppercase tracking-[0.28em] text-slate-400 font-light">
                  {cat.secaoLabel}
                </span>
                <h2 className="mt-1 text-xl md:text-2xl font-light text-navy tracking-tight">{cat.label}</h2>
              </div>
              <span className="text-[11px] text-slate-400 font-light tabular-nums shrink-0">
                {cat.produtos.length} itens
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-x-3 gap-y-8 md:gap-x-6 md:gap-y-12">
              {cat.produtos.map((p, i) => (
                <Top10ProductCard
                  key={p.id + cat.slug}
                  product={p}
                  rank={i + 1}
                  onAdd={handleAdd}
                  onOpen={(prod) => setOpenId(prod.id)}
                />
              ))}
            </div>
          </section>
        ))}
      </main>

      <Top10ProductModal product={openProduct} onClose={() => setOpenId(null)} />
      <TopCartBar />
    </div>
  );
};

const Top10Produtos = () => (
  <TopProdutosCartProvider>
    <Top10Inner />
  </TopProdutosCartProvider>
);

export default Top10Produtos;
