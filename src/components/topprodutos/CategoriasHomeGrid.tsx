import { useMemo } from "react";
import { ArrowUpRight } from "lucide-react";
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
      // colher até 4 miniaturas para o tile "Ver tudo"
      return { ...c, image, count: products.length, products };
    }).filter((c) => c.count > 0);
  }, [data, metaMap]);

  const totalCount = cats.reduce((acc, c) => acc + c.count, 0);
  const previewImgs = cats
    .map((c) => c.image)
    .filter(Boolean)
    .slice(0, 4) as string[];

  return (
    <section className="container mx-auto px-4 sm:px-6 lg:px-12">
      {/* Cabeçalho editorial */}
      <div className="mb-12 md:mb-16 max-w-3xl">
        <div className="flex items-center gap-3 mb-4">
          <span className="w-8 h-px bg-green-cta" />
          <span className="text-green-cta font-medium tracking-[0.25em] text-[10px] md:text-[11px] uppercase">
            Catálogo B2B · {totalCount} produtos
          </span>
        </div>
        <h2
          className="text-4xl md:text-6xl font-light text-navy tracking-tight leading-[1.05]"
          style={{ fontFamily: "'Georgia', serif" }}
        >
          Escolha por <em className="text-green-cta not-italic font-normal italic">categoria</em>.
        </h2>
        <p className="mt-4 text-sm md:text-base text-slate-500 font-light max-w-xl leading-relaxed">
          Coleção curada para o mercado corporativo. Toque em uma categoria para explorar os itens disponíveis.
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-10 md:gap-x-10 md:gap-y-16">
          {/* Ver tudo — tile editorial com mosaico de miniaturas */}
          <button
            type="button"
            onClick={onSelectAll}
            className="group flex flex-col items-center gap-3 md:gap-4 focus:outline-none"
          >
            <div className="relative w-full aspect-square rounded-full overflow-hidden bg-white transition-transform duration-300 group-hover:scale-[1.03] group-active:scale-95 ring-1 ring-slate-200 group-hover:ring-navy/40">
              {/* Mosaico 2x2 de miniaturas dos produtos */}
              <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
                {previewImgs.length > 0
                  ? Array.from({ length: 4 }).map((_, i) => {
                      const src = previewImgs[i % previewImgs.length];
                      return (
                        <div key={i} className="relative overflow-hidden bg-slate-50">
                          <img
                            src={src}
                            alt=""
                            loading="lazy"
                            aria-hidden="true"
                            className="absolute inset-0 w-full h-full object-cover opacity-90 transition-transform duration-700 group-hover:scale-110"
                          />
                        </div>
                      );
                    })
                  : (
                    <div className="col-span-2 row-span-2 bg-gradient-to-br from-slate-100 to-slate-50" />
                  )}
              </div>

              {/* Véu para leitura */}
              <div className="absolute inset-0 bg-navy/55 group-hover:bg-navy/45 transition-colors" />

              {/* Rótulo central minimalista */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white px-4 text-center">
                <span
                  className="text-3xl md:text-5xl font-light italic leading-none"
                  style={{ fontFamily: "'Georgia', serif" }}
                >
                  {totalCount}
                </span>
                <span className="mt-2 text-[9px] md:text-[10px] font-medium uppercase tracking-[0.28em] text-white/80">
                  Ver tudo
                </span>
                <span className="mt-3 flex items-center gap-1 text-[9px] md:text-[10px] font-normal uppercase tracking-[0.22em] text-green-cta">
                  Explorar
                  <ArrowUpRight className="w-3 h-3" strokeWidth={2} />
                </span>
              </div>
            </div>
            <div className="text-center">
              <span className="block text-sm md:text-base font-normal text-navy leading-tight">
                Todos os produtos
              </span>
              <span className="block text-[10px] md:text-xs text-slate-400 mt-1 font-light tracking-widest uppercase">
                Catálogo completo
              </span>
            </div>
          </button>

          {cats.map((cat, idx) => (
            <button
              key={cat.slug}
              type="button"
              onClick={() => onSelectCategory(cat.slug)}
              className="group flex flex-col items-center gap-3 md:gap-4 focus:outline-none"
            >
              <div className="relative w-full aspect-square rounded-full overflow-hidden bg-slate-100 transition-transform duration-300 group-hover:scale-[1.03] group-active:scale-95 ring-1 ring-slate-200/70">
                {cat.image ? (
                  <img
                    src={cat.image}
                    alt={cat.label}
                    loading="lazy"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-slate-200 to-slate-100" />
                )}
                {/* Gradiente sutil só na base para número da coleção */}
                <div className="absolute inset-0 bg-gradient-to-t from-navy/70 via-navy/10 to-transparent" />
                {/* Índice tipográfico */}
                <span
                  className="absolute top-3 left-1/2 -translate-x-1/2 text-[10px] md:text-xs font-light tracking-[0.28em] uppercase text-white/70"
                  style={{ fontFamily: "'Georgia', serif" }}
                >
                  N°{String(idx + 1).padStart(2, "0")}
                </span>
                {/* Ring on hover */}
                <div className="absolute inset-0 rounded-full ring-2 ring-green-cta/0 group-hover:ring-green-cta/70 transition" />
                {/* Contagem no rodapé do círculo */}
                <span className="absolute bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 text-[10px] md:text-xs font-medium tracking-widest text-white">
                  {cat.count} {cat.count === 1 ? "item" : "itens"}
                </span>
              </div>
              <div className="text-center px-1">
                <span className="block text-sm md:text-base font-normal text-navy leading-tight line-clamp-2">
                  {cat.label}
                </span>
                <span className="block text-[10px] md:text-xs text-slate-400 mt-1 font-light tracking-widest uppercase">
                  Coleção
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
