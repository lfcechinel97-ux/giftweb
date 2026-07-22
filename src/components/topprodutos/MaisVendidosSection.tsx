import TopProductCard from "./TopProductCard";
import type { TopProduct } from "./TopProductCard";
import { useCuratedTopProdutos } from "@/hooks/useCuratedTopProdutos";

interface Props {
  onAdd?: (product: TopProduct, quantidade: number) => void;
}

const MaisVendidosSection = ({ onAdd }: Props) => {
  const { data, isLoading } = useCuratedTopProdutos();

  const items = (data ?? []).filter((p) => p.mais_vendido).slice(0, 10);
  const skeletons = isLoading && items.length === 0 ? Array.from({ length: 8 }).map(() => null) : [];
  const list: (TopProduct | null)[] = items.length > 0 ? items : skeletons;

  if (!isLoading && items.length === 0) {
    return null;
  }

  return (
    <section className="w-full">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4 mb-6 sm:mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-foreground tracking-tight">
              Mais vendidos
            </h2>
            <p className="mt-1.5 text-sm sm:text-base text-muted-foreground">
              Os brindes que mais saem do estoque.
            </p>
          </div>
        </div>
      </div>

      <div className="lg:hidden">
        <div
          className="flex gap-4 overflow-x-auto snap-x snap-mandatory px-4 sm:px-6 pb-4"
          style={{ scrollBehavior: "smooth", WebkitOverflowScrolling: "touch" }}
        >
          {list.map((p, i) => (
            <div key={p?.id ?? `skel-${i}`} className="snap-start shrink-0 w-[78%] sm:w-[46%]">
              {p ? (
                <TopProductCard product={p} onAdd={onAdd} />
              ) : (
                <div className="aspect-[4/5] rounded-[12px] bg-muted/40 animate-pulse" />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="hidden lg:block container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-4 gap-6">
          {list.map((p, i) => (
            <div key={p?.id ?? `skel-${i}`}>
              {p ? (
                <TopProductCard product={p} onAdd={onAdd} />
              ) : (
                <div className="aspect-[4/5] rounded-[12px] bg-muted/40 animate-pulse" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default MaisVendidosSection;
