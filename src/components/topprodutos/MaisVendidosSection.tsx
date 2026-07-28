import TopProductCard from "./TopProductCard";
import type { TopProduct } from "./TopProductCard";
import { useCuratedTopProdutos } from "@/hooks/useCuratedTopProdutos";

interface Props {
  onAdd?: (product: TopProduct, quantidade: number) => void;
  onOpen?: (product: TopProduct) => void;
}

const MaisVendidosSection = ({ onAdd, onOpen }: Props) => {
  const { data, isLoading } = useCuratedTopProdutos();


  const items = (data ?? []).filter((p) => p.mais_vendido).slice(0, 10);

  if (!isLoading && items.length === 0) return null;

  return (
    <section className="container mx-auto px-4 sm:px-6 lg:px-12">
      {/* Cabeçalho editorial */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 md:mb-16">
        <div className="space-y-3">
          <span className="text-green-cta font-medium tracking-[0.2em] text-xs uppercase">
            Curadoria Premium
          </span>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-light text-navy tracking-tight leading-[1.05]">
            Mais vendidos
          </h2>
        </div>
        <div className="max-w-xs text-slate-500 text-sm leading-relaxed border-l border-green-cta pl-6 font-light">
          A excelência em brindes corporativos. Produtos selecionados por performance e design exclusivo.
        </div>
      </div>

      {isLoading && items.length === 0 ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-3 md:gap-x-8 gap-y-6 md:gap-y-10">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[4/5] bg-slate-100 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-3 md:gap-x-8 gap-y-6 md:gap-y-10">
          {items.map((p) => (
            <TopProductCard key={p.id} product={p} onAdd={onAdd} onOpen={onOpen} />
          ))}
        </div>
      )}
    </section>
  );
};

export default MaisVendidosSection;
