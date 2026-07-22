import TopProductCard from "./TopProductCard";
import type { TopProduct } from "./TopProductCard";
import { useCuratedTopProdutos } from "@/hooks/useCuratedTopProdutos";

interface Props {
  onAdd?: (product: TopProduct, quantidade: number) => void;
}

const MaisVendidosSection = ({ onAdd }: Props) => {
  const { data, isLoading } = useCuratedTopProdutos();

  const items = (data ?? []).filter((p) => p.mais_vendido).slice(0, 10);

  if (!isLoading && items.length === 0) return null;

  const [featured, ...rest] = items;
  const sideItems = rest.slice(0, 2);
  const tailItems = rest.slice(2);

  return (
    <section className="container mx-auto px-4 sm:px-6 lg:px-12">
      {/* Cabeçalho editorial */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 md:mb-16">
        <div className="space-y-3">
          <span className="text-green-cta font-bold tracking-[0.2em] text-xs uppercase">
            Curadoria Premium
          </span>
          <h2 className="text-5xl md:text-6xl lg:text-7xl font-black text-navy tracking-tighter leading-none">
            Mais vendidos
          </h2>
        </div>
        <div className="max-w-xs text-slate-500 text-sm leading-relaxed border-l-2 border-green-cta pl-6">
          A excelência em brindes corporativos. Produtos selecionados por performance e design exclusivo.
        </div>
      </div>

      {isLoading && items.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
          <div className="md:col-span-8 aspect-[16/9] bg-slate-100 animate-pulse" />
          <div className="md:col-span-4 space-y-16">
            <div className="aspect-square bg-slate-100 animate-pulse" />
            <div className="aspect-square bg-slate-100 animate-pulse" />
          </div>
        </div>
      ) : (
        <>
          {/* Composição editorial: destaque + 2 laterais */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10 md:gap-12">
            {featured && (
              <div className="md:col-span-8">
                <TopProductCard
                  product={featured}
                  onAdd={onAdd}
                  variant="hero"
                  badge="Destaque do Mês"
                />
              </div>
            )}
            {sideItems.length > 0 && (
              <div className="md:col-span-4 space-y-12 md:space-y-16">
                {sideItems.map((p) => (
                  <TopProductCard key={p.id} product={p} onAdd={onAdd} variant="side" />
                ))}
              </div>
            )}
          </div>

          {/* Restante dos mais vendidos em grid respiro */}
          {tailItems.length > 0 && (
            <div className="mt-20 grid grid-cols-2 lg:grid-cols-4 gap-x-8 md:gap-x-12 gap-y-16">
              {tailItems.map((p) => (
                <TopProductCard key={p.id} product={p} onAdd={onAdd} variant="grid" />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default MaisVendidosSection;
