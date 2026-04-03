import { useState } from "react";
import { Search, X, ChevronDown, SlidersHorizontal } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { getCorHex, isLightColor } from "@/utils/colorHex";
import { useBaseCategories } from "@/hooks/useBaseCategories";
import { formatarBRL } from "@/utils/price";

interface Filters {
  search: string;
  categoria: string | null;
  corValues: string[];
  precoMin: number;
  precoMax: number;
  apenasEstoque: boolean;
  sort: string;
}

interface CatalogFilterBarProps {
  filters: Filters;
  onChange: (partial: Partial<Filters>) => void;
  onClear: () => void;
  cores: string[];
  maxPreco: number;
  totalProducts: number;
}

const SORT_OPTIONS = [
  { val: "relevancia", label: "Mais relevantes" },
  { val: "menor_preco", label: "Menor preço" },
  { val: "maior_preco", label: "Maior preço" },
  { val: "maior_estoque", label: "Maior estoque" },
  { val: "az", label: "A → Z" },
];

const CatalogFilterBar = ({ filters, onChange, onClear, cores, maxPreco, totalProducts }: CatalogFilterBarProps) => {
  const { data: categories = [] } = useBaseCategories();
  const [showColors, setShowColors] = useState(false);
  const [showCategories, setShowCategories] = useState(false);

  const hasFilters = !!(
    filters.search ||
    filters.categoria ||
    filters.corValues.length > 0 ||
    filters.precoMin > 0 ||
    filters.precoMax < maxPreco
  );

  const activeCategory = categories.find(c => c.slug === filters.categoria);

  return (
    <div id="catalog-products" className="scroll-mt-20">
      {/* Main filter row */}
      <div className="bg-card border border-border rounded-xl p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar produto..."
              value={filters.search}
              onChange={e => onChange({ search: e.target.value })}
              className="w-full pl-10 pr-9 py-2 rounded-lg bg-background border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-green-cta focus:ring-2 focus:ring-green-cta/15 transition-colors"
            />
            {filters.search && (
              <button onClick={() => onChange({ search: "" })} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>

          {/* Category dropdown */}
          <div className="relative">
            <button
              onClick={() => { setShowCategories(!showCategories); setShowColors(false); }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors ${
                filters.categoria
                  ? "border-green-cta text-green-cta bg-green-cta/5"
                  : "border-border text-muted-foreground hover:text-foreground bg-background"
              }`}
            >
              {activeCategory?.label || "Categoria"}
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {showCategories && (
              <div className="absolute top-full left-0 mt-1 w-56 max-h-64 overflow-y-auto rounded-xl bg-card border border-border shadow-lg z-30 py-1">
                <button
                  onClick={() => { onChange({ categoria: null }); setShowCategories(false); }}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                    !filters.categoria ? "text-green-cta font-semibold bg-green-cta/5" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  Todas
                </button>
                {categories.map(cat => (
                  <button
                    key={cat.slug}
                    onClick={() => { onChange({ categoria: cat.slug }); setShowCategories(false); }}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                      filters.categoria === cat.slug
                        ? "text-green-cta font-semibold bg-green-cta/5"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Price range */}
          <div className="flex items-center gap-2 min-w-[220px]">
            <span className="text-xs text-muted-foreground whitespace-nowrap">Preço:</span>
            <div className="flex-1">
              <Slider
                min={0}
                max={maxPreco}
                step={5}
                value={[filters.precoMin, filters.precoMax]}
                onValueChange={([min, max]) => onChange({ precoMin: min, precoMax: max })}
              />
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {formatarBRL(filters.precoMin)} – {formatarBRL(filters.precoMax)}
            </span>
          </div>

          {/* Color toggle */}
          <button
            onClick={() => { setShowColors(!showColors); setShowCategories(false); }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors ${
              filters.corValues.length > 0
                ? "border-green-cta text-green-cta bg-green-cta/5"
                : "border-border text-muted-foreground hover:text-foreground bg-background"
            }`}
          >
            <div className="flex -space-x-1">
              {filters.corValues.length > 0
                ? filters.corValues.slice(0, 3).map(c => (
                    <span key={c} className="w-4 h-4 rounded-full border border-background" style={{ backgroundColor: getCorHex(c) }} />
                  ))
                : <SlidersHorizontal className="w-3.5 h-3.5" />
              }
            </div>
            Cor {filters.corValues.length > 0 && `(${filters.corValues.length})`}
          </button>

          {/* Sort */}
          <div className="relative">
            <select
              value={filters.sort}
              onChange={e => onChange({ sort: e.target.value })}
              className="appearance-none pl-3 pr-8 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:border-green-cta cursor-pointer"
            >
              {SORT_OPTIONS.map(o => (
                <option key={o.val} value={o.val}>{o.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        {/* Color swatches panel */}
        {showColors && cores.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border">
            <div className="flex flex-wrap gap-2">
              {cores.map(c => {
                const hex = getCorHex(c);
                const light = isLightColor(hex);
                const isSelected = filters.corValues.includes(c);
                return (
                  <button
                    key={c}
                    title={c}
                    onClick={() => {
                      const next = isSelected
                        ? filters.corValues.filter(v => v !== c)
                        : [...filters.corValues, c];
                      onChange({ corValues: next });
                    }}
                    className="flex flex-col items-center gap-1"
                  >
                    <span
                      className="w-7 h-7 rounded-full transition-all duration-150"
                      style={{
                        backgroundColor: hex,
                        border: light ? "1.5px solid hsl(var(--border))" : "1.5px solid transparent",
                        boxShadow: isSelected
                          ? "0 0 0 2px hsl(var(--background)), 0 0 0 4px hsl(142,71%,45%)"
                          : "0 1px 3px rgba(0,0,0,0.15)",
                        transform: isSelected ? "scale(1.15)" : "scale(1)",
                      }}
                    />
                    <span className={`text-[10px] leading-none max-w-[36px] text-center truncate ${isSelected ? "text-green-cta font-semibold" : "text-muted-foreground"}`}>
                      {c.charAt(0).toUpperCase() + c.slice(1).toLowerCase()}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Active filter chips + count */}
      <div className="flex items-center gap-2 flex-wrap mb-5">
        <span className="text-sm text-muted-foreground">{totalProducts} produtos encontrados</span>

        {hasFilters && (
          <>
            <span className="text-border">|</span>
            {filters.categoria && activeCategory && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-cta/10 text-green-cta text-xs font-medium">
                {activeCategory.label}
                <button onClick={() => onChange({ categoria: null })}><X className="w-3 h-3" /></button>
              </span>
            )}
            {filters.corValues.map(c => (
              <span key={c} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-cta/10 text-green-cta text-xs font-medium">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: getCorHex(c) }} />
                {c}
                <button onClick={() => onChange({ corValues: filters.corValues.filter(v => v !== c) })}><X className="w-3 h-3" /></button>
              </span>
            ))}
            {(filters.precoMin > 0 || filters.precoMax < maxPreco) && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-cta/10 text-green-cta text-xs font-medium">
                {formatarBRL(filters.precoMin)} – {formatarBRL(filters.precoMax)}
                <button onClick={() => onChange({ precoMin: 0, precoMax: maxPreco })}><X className="w-3 h-3" /></button>
              </span>
            )}
            {filters.search && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-cta/10 text-green-cta text-xs font-medium">
                "{filters.search}"
                <button onClick={() => onChange({ search: "" })}><X className="w-3 h-3" /></button>
              </span>
            )}
            <button onClick={onClear} className="text-xs text-muted-foreground hover:text-foreground underline ml-1">
              Limpar tudo
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default CatalogFilterBar;
