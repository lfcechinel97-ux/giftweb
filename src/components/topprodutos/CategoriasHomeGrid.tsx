import { useMemo } from "react";
import { LayoutGrid } from "lucide-react";
import {
  useCuratedTopProdutos,
  useCategoriasMeta,
  TOPPRODUTOS_CATEGORIAS,
} from "@/hooks/useCuratedTopProdutos";

interface Props {
  onSelectCategory: (slug: string) => void;
  onSelectAll: () => void;
}

const CategoriasHomeGrid = ({ onSelectCategory, onSelectAll }: Props) => {
  const { data, isLoading } = useCuratedTopProdutos();
  const { data: metaMap } = useCategoriasMeta();

  const cats = useMemo(() => {
    return TOPPRODUTOS_CATEGORIAS.map((c) => {
      const products = (data ?? []).filter((p) => p.categoria === c.slug);
      const meta = metaMap?.get(c.slug);
      const image =
        meta?.imagem_capa ||
        products.find((p) => p.image_url)?.image_url ||
        null;
      return { ...c, image, count: products.length };
    }).filter((c) => c.count > 0);
  }, [data, metaMap]);

  return (
    <section className="container mx-auto px-4 sm:px-6 lg:px-12">
      <div className="mb-10 md:mb-14 text-center md:text-left">
        <span className="block text-green-cta font-bold tracking-[0.2em] text-[10px] md:text-xs uppercase mb-2">
          Escolha por categoria
        </span>
        <h2 className="text-4xl md:text-6xl font-black text-navy tracking-tighter leading-none">
          Categorias
        </h2>
        <p className="mt-3 text-sm text-slate-500 max-w-md mx-auto md:mx-0">
          Toque em uma categoria para ver os produtos disponíveis.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-10">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-3">
              <div className="w-full aspect-square rounded-full bg-slate-100 animate-pulse" />
              <div className="h-3 w-20 bg-slate-100 animate-pulse rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-8 md:gap-x-10 md:gap-y-14">
          {/* Todos os produtos — primeiro item */}
          <button
            type="button"
            onClick={onSelectAll}
            className="group flex flex-col items-center gap-3 md:gap-4 focus:outline-none"
          >
            <div
              className="relative w-full aspect-square rounded-full overflow-hidden bg-navy flex items-center justify-center transition-transform duration-300 group-hover:scale-[1.03] group-active:scale-95"
              style={{ boxShadow: "0 10px 30px -12px rgba(15,23,42,0.35)" }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-navy via-navy to-slate-800" />
              <div className="relative flex flex-col items-center gap-2 text-white px-4 text-center">
                <LayoutGrid className="w-8 h-8 md:w-10 md:h-10 text-green-cta" strokeWidth={1.8} />
                <span className="text-[10px] md:text-xs font-bold uppercase tracking-[0.15em] leading-tight">
                  Ver tudo
                </span>
              </div>
              <div className="absolute inset-0 rounded-full ring-2 ring-green-cta/0 group-hover:ring-green-cta/60 transition" />
            </div>
            <div className="text-center">
              <span className="block text-sm md:text-base font-bold text-navy leading-tight">
                Todos os produtos
              </span>
              <span className="block text-[10px] md:text-xs text-slate-400 mt-1 uppercase tracking-widest">
                Catálogo completo
              </span>
            </div>
          </button>

          {cats.map((cat) => (
            <button
              key={cat.slug}
              type="button"
              onClick={() => onSelectCategory(cat.slug)}
              className="group flex flex-col items-center gap-3 md:gap-4 focus:outline-none"
            >
              <div
                className="relative w-full aspect-square rounded-full overflow-hidden bg-slate-100 transition-transform duration-300 group-hover:scale-[1.03] group-active:scale-95"
                style={{ boxShadow: "0 10px 30px -14px rgba(15,23,42,0.25)" }}
              >
                {cat.image ? (
                  <img
                    src={cat.image}
                    alt={cat.label}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-200 to-slate-100" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
                <div className="absolute inset-0 rounded-full ring-2 ring-green-cta/0 group-hover:ring-green-cta/60 transition" />
              </div>
              <div className="text-center px-1">
                <span className="block text-sm md:text-base font-bold text-navy leading-tight line-clamp-2">
                  {cat.label}
                </span>
                <span className="block text-[10px] md:text-xs text-slate-400 mt-1 uppercase tracking-widest">
                  {cat.count} {cat.count === 1 ? "produto" : "produtos"}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
};

export default CategoriasHomeGrid;
