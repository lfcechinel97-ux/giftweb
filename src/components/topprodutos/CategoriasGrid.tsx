import { useMemo, useState } from "react";
import TopProductCard from "./TopProductCard";
import type { TopProduct } from "./TopProductCard";
import { useCuratedTopProdutos, TOPPRODUTOS_CATEGORIAS } from "@/hooks/useCuratedTopProdutos";
import { cn } from "@/lib/utils";

interface Props {
  onAdd?: (product: TopProduct, quantidade: number) => void;
}

const CategoriasGrid = ({ onAdd }: Props) => {
  const { data, isLoading } = useCuratedTopProdutos();
  const [active, setActive] = useState<string>("__all__");

  const byCat = useMemo(() => {
    const m = new Map<string, typeof data>();
    (data ?? []).forEach((p) => {
      const arr = (m.get(p.categoria) ?? []) as any[];
      arr.push(p);
      m.set(p.categoria, arr as any);
    });
    return m;
  }, [data]);

  const catLabel = (slug: string) =>
    TOPPRODUTOS_CATEGORIAS.find((c) => c.slug === slug)?.label ?? slug;

  const availableCats = TOPPRODUTOS_CATEGORIAS.filter((c) => (byCat.get(c.slug) ?? []).length > 0);

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-12">
      {/* Chips de categoria */}
      <div className="mb-12 md:mb-16 overflow-x-auto pb-3 -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-3 min-w-max">
          <button
            type="button"
            onClick={() => setActive("__all__")}
            className={cn(
              "px-6 md:px-8 py-2.5 md:py-3 rounded-full text-xs md:text-sm font-bold transition-all",
              active === "__all__"
                ? "bg-navy text-white scale-100"
                : "border border-slate-200 bg-white text-slate-600 hover:border-navy hover:text-navy"
            )}
          >
            Tudo
          </button>
          {availableCats.map((cat) => (
            <button
              key={cat.slug}
              type="button"
              onClick={() => setActive(cat.slug)}
              className={cn(
                "px-6 md:px-8 py-2.5 md:py-3 rounded-full text-xs md:text-sm font-medium transition-all",
                active === cat.slug
                  ? "bg-navy text-white font-bold"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-navy hover:text-navy"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-8 md:gap-x-12 gap-y-16">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : active === "__all__" ? (
        <div key="all" className="flex flex-col gap-20 md:gap-28 animate-fade-in">
          {availableCats.map((cat) => {
            const items = (byCat.get(cat.slug) ?? []) as TopProduct[];
            return (
              <section key={cat.slug}>
                <div className="flex items-baseline justify-between mb-8 md:mb-10 border-b border-slate-200 pb-4">
                  <h3 className="text-2xl md:text-3xl font-bold text-navy tracking-tight">
                    {cat.label}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setActive(cat.slug)}
                    className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-navy transition-colors"
                  >
                    Ver categoria →
                  </button>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-8 md:gap-x-12 gap-y-16">
                  {items.map((p) => (
                    <TopProductCard
                      key={p.id}
                      product={p}
                      onAdd={onAdd}
                      variant="grid"
                      eyebrow={cat.label}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div key={active} className="animate-fade-in">
          <h3 className="text-3xl md:text-4xl font-black text-navy tracking-tight mb-10 md:mb-12">
            {catLabel(active)}
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-8 md:gap-x-12 gap-y-16">
            {((byCat.get(active) ?? []) as TopProduct[]).map((p) => (
              <TopProductCard
                key={p.id}
                product={p}
                onAdd={onAdd}
                variant="grid"
                eyebrow={catLabel(active)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoriasGrid;
