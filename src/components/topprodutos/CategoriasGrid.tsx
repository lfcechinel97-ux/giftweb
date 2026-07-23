import { useMemo, useState } from "react";
import TopProductCard, { TopProductSize } from "./TopProductCard";
import type { TopProduct } from "./TopProductCard";
import {
  useCuratedTopProdutos,
  useCategoriasMeta,
  TOPPRODUTOS_CATEGORIAS,
  type CuratedProduct,
  type DestaqueLevel,
} from "@/hooks/useCuratedTopProdutos";
import { cn } from "@/lib/utils";
import { getPalette } from "./categoryPalettes";

interface Props {
  onAdd?: (product: TopProduct, quantidade: number) => void;
  onOpen?: (product: TopProduct) => void;
}

const destaqueToSize = (d: DestaqueLevel): TopProductSize =>
  d === "grande" ? "L" : d === "medio" ? "M" : "S";

// grid-column/row spans per size on desktop (4 cols) and mobile (2 cols)
const spanClass = (size: TopProductSize) => {
  if (size === "L") return "col-span-2 row-span-2 md:col-span-2 md:row-span-2";
  if (size === "M") return "col-span-2 row-span-1 md:col-span-2 md:row-span-1";
  return "col-span-1 row-span-1";
};

const CategoryHeader = ({
  index,
  label,
  eyebrow,
  imagemCapa,
  count,
  onSeeAll,
}: {
  index: number;
  label: string;
  eyebrow?: string | null;
  imagemCapa?: string | null;
  count: number;
  onSeeAll: () => void;
}) => {
  // Rotate 3 header styles so categorias look distinct even when meta is empty.
  const style = index % 3;

  if (imagemCapa) {
    return (
      <div className="relative w-full h-48 md:h-64 mb-10 md:mb-14 overflow-hidden bg-navy">
        <img src={imagemCapa} alt={label} className="absolute inset-0 w-full h-full object-cover opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-r from-navy/80 via-navy/40 to-transparent" />
        <div className="relative h-full flex flex-col justify-end p-6 md:p-10">
          {eyebrow && (
            <span className="text-green-cta text-[10px] md:text-xs font-bold uppercase tracking-[0.25em] mb-2">
              {eyebrow}
            </span>
          )}
          <h3 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-none">
            {label}
          </h3>
        </div>
      </div>
    );
  }

  if (style === 0) {
    return (
      <div className="flex items-end justify-between mb-8 md:mb-10 border-b border-slate-200 pb-4">
        <div>
          {eyebrow && (
            <span className="block text-green-cta text-[10px] font-bold uppercase tracking-[0.25em] mb-2">
              {eyebrow}
            </span>
          )}
          <h3 className="text-3xl md:text-4xl font-bold text-navy tracking-tight">{label}</h3>
        </div>
        <button
          type="button"
          onClick={onSeeAll}
          className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-navy transition-colors"
        >
          Ver categoria →
        </button>
      </div>
    );
  }

  if (style === 1) {
    return (
      <div className="flex items-center gap-6 md:gap-8 mb-8 md:mb-12">
        <span className="text-6xl md:text-8xl font-black text-slate-100 tabular-nums leading-none select-none">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div className="flex-1 min-w-0">
          {eyebrow && (
            <span className="block text-green-cta text-[10px] font-bold uppercase tracking-[0.25em] mb-2">
              {eyebrow}
            </span>
          )}
          <h3 className="text-2xl md:text-4xl font-bold text-navy tracking-tight leading-tight">
            {label}
          </h3>
          <p className="text-slate-400 text-xs uppercase tracking-widest mt-2">{count} modelos</p>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center mb-10 md:mb-14">
      <span className="inline-block text-slate-400 text-[10px] font-bold uppercase tracking-[0.3em] mb-4 border-b border-slate-200 pb-2">
        {eyebrow || `Categoria · ${String(index + 1).padStart(2, "0")}`}
      </span>
      <h3 className="text-3xl md:text-5xl font-black text-navy tracking-tighter">{label}</h3>
    </div>
  );
};

// Wrapper com media query embutida para virar 4 colunas no desktop.
const Mosaic = ({
  items,
  eyebrow,
  categoria,
  onAdd,
  onOpen,
}: {
  items: CuratedProduct[];
  eyebrow: string;
  categoria: string;
  onAdd?: Props["onAdd"];
  onOpen?: Props["onOpen"];
}) => {
  if (items.length === 0) return null;
  const palette = getPalette(categoria);
  const hasHighlight = items.some((p) => p.destaque !== "padrao");

  if (!hasHighlight) {
    // Sem destaques: grid uniforme, mas cada tile já rotaciona cor da categoria.
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {items.map((p, i) => (
          <TopProductCard
            key={p.id}
            product={p}
            onAdd={onAdd}
            onOpen={onOpen}
            size="S"
            eyebrow={eyebrow}
            tile={palette[i % palette.length]}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="top-mosaic-wrapper">
      <div
        className="top-mosaic grid gap-4 md:gap-6"
        style={{
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gridAutoRows: "minmax(240px, auto)",
          gridAutoFlow: "dense",
        }}
      >
        {items.map((p, i) => {
          const size = destaqueToSize(p.destaque);
          return (
            <div key={p.id} className={cn(spanClass(size), "flex")}>
              <div className="flex flex-col w-full">
                <TopProductCard
                  product={p}
                  onAdd={onAdd}
                  onOpen={onOpen}
                  size={size}
                  eyebrow={eyebrow}
                  tile={palette[i % palette.length]}
                />
              </div>
            </div>
          );
        })}
      </div>
      <style>{`
        @media (min-width: 768px) {
          .top-mosaic {
            grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
            grid-auto-rows: minmax(300px, auto) !important;
          }
        }
      `}</style>
    </div>
  );
};

const CategoriasGrid = ({ onAdd, onOpen }: Props) => {
  const { data, isLoading } = useCuratedTopProdutos();
  const { data: metaMap } = useCategoriasMeta();
  const [active, setActive] = useState<string>("__all__");

  const byCat = useMemo(() => {
    const m = new Map<string, CuratedProduct[]>();
    (data ?? []).forEach((p) => {
      const arr = m.get(p.categoria) ?? [];
      arr.push(p);
      m.set(p.categoria, arr);
    });
    return m;
  }, [data]);

  const catLabel = (slug: string) =>
    TOPPRODUTOS_CATEGORIAS.find((c) => c.slug === slug)?.label ?? slug;

  const availableCats = TOPPRODUTOS_CATEGORIAS.filter(
    (c) => (byCat.get(c.slug) ?? []).length > 0
  );

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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-10">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[4/5] bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : active === "__all__" ? (
        <div className="flex flex-col gap-24 md:gap-32 animate-fade-in">
          {availableCats.map((cat, idx) => {
            const items = byCat.get(cat.slug) ?? [];
            const meta = metaMap?.get(cat.slug);
            return (
              <section key={cat.slug}>
                <CategoryHeader
                  index={idx}
                  label={cat.label}
                  eyebrow={meta?.eyebrow}
                  imagemCapa={meta?.imagem_capa}
                  count={items.length}
                  onSeeAll={() => setActive(cat.slug)}
                />
                <Mosaic items={items} eyebrow={cat.label} categoria={cat.slug} onAdd={onAdd} onOpen={onOpen} />
              </section>
            );
          })}
        </div>
      ) : (
        <div key={active} className="animate-fade-in">
          {(() => {
            const items = byCat.get(active) ?? [];
            const meta = metaMap?.get(active);
            const idx = availableCats.findIndex((c) => c.slug === active);
            return (
              <>
                <CategoryHeader
                  index={idx >= 0 ? idx : 0}
                  label={catLabel(active)}
                  eyebrow={meta?.eyebrow}
                  imagemCapa={meta?.imagem_capa}
                  count={items.length}
                  onSeeAll={() => setActive(active)}
                />
                <Mosaic items={items} eyebrow={catLabel(active)} categoria={active} onAdd={onAdd} onOpen={onOpen} />
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default CategoriasGrid;
