import TopProductCard from "./TopProductCard";
import type { TopProduct } from "./TopProductCard";
import { useCuratedTopProdutos, TOPPRODUTOS_CATEGORIAS } from "@/hooks/useCuratedTopProdutos";

interface Props {
  onAdd?: (product: TopProduct, quantidade: number) => void;
}

const CategoriasGrid = ({ onAdd }: Props) => {
  const { data, isLoading } = useCuratedTopProdutos();

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[4/5] rounded-[12px] bg-muted/40 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const byCat = new Map<string, TopProduct[]>();
  (data ?? []).forEach((p) => {
    const arr = byCat.get(p.categoria) ?? [];
    arr.push(p);
    byCat.set(p.categoria, arr);
  });

  return (
    <div className="flex flex-col gap-12 sm:gap-16">
      {TOPPRODUTOS_CATEGORIAS.map((cat) => {
        const items = byCat.get(cat.slug) ?? [];
        if (items.length === 0) return null;
        return (
          <section key={cat.slug} className="container mx-auto px-4 sm:px-6 lg:px-8">
            <h3 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight mb-4 sm:mb-6">
              {cat.label}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {items.map((p) => (
                <TopProductCard key={p.id} product={p} onAdd={onAdd} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
};

export default CategoriasGrid;
