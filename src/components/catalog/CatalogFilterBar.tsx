import { useState } from "react";
import { Search, X, ChevronDown, Medal } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { useBaseCategories } from "@/hooks/useBaseCategories";
import { formatarBRL } from "@/utils/price";
import { CATALOG_SWATCH_COLORS } from "@/components/catalog/catalogSwatchColors";

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

const QUICK_PRICES = [
  { label: "Até R$10", min: 0, max: 10 },
  { label: "Até R$30", min: 0, max: 30 },
  { label: "Até R$50", min: 0, max: 50, badge: true },
  { label: "Até R$100", min: 0, max: 100 },
];

const CatalogFilterBar = ({ filters, onChange, onClear, cores, maxPreco, totalProducts }: CatalogFilterBarProps) => {
  const { data: categories = [] } = useBaseCategories();
  const [showCategories, setShowCategories] = useState(false);

  const hasFilters = !!(
    filters.search ||
    filters.categoria ||
    filters.corValues.length > 0 ||
    filters.precoMin > 0 ||
    filters.precoMax < maxPreco
  );

  const activeCategory = categories.find(c => c.slug === filters.categoria);

  const handleQuickPrice = (min: number, max: number) => {
    if (filters.precoMin === min && filters.precoMax === max) {
      onChange({ precoMin: 0, precoMax: maxPreco });
    } else {
      onChange({ precoMin: min, precoMax: max });
    }
  };

  const handleColorToggle = (swatchName: string) => {
    const swatch = CATALOG_SWATCH_COLORS.find(s => s.name === swatchName);
    if (!swatch) return;
    const allValues = swatch.values;
    const isSelected = allValues.some(v => filters.corValues.includes(v));
    if (isSelected) {
      onChange({ corValues: filters.corValues.filter(v => !allValues.includes(v)) });
    } else {
      onChange({ corValues: [...filters.corValues, ...allValues] });
    }
  };

  const isSwatchSelected = (swatch: typeof CATALOG_SWATCH_COLORS[0]) =>
    swatch.values.some(v => filters.corValues.includes(v));

  return (
    <div id="catalog-products" className="scroll-mt-20">
      <div className="bg-card border border-border rounded-xl p-5 mb-4 space-y-5">
        {/* Row 1: Search + Category */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[hsl(var(--green-cta))] text-primary-foreground text-[10px] font-bold flex-shrink-0">1º</span>
            <span className="text-sm font-bold text-[hsl(var(--green-cta))]">Selecione a categoria</span>
          </div>
          <div className="flex gap-3">
            <div className="relative flex-[3] min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar produto..."
              value={filters.search}
              onChange={e => onChange({ search: e.target.value })}
              className="w-full pl-10 pr-9 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-[hsl(var(--green-cta))] focus:ring-2 focus:ring-[hsl(var(--green-cta))]/15 transition-colors"
            />
            {filters.search && (
              <button onClick={() => onChange({ search: "" })} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>

          <div className="relative flex-[2] min-w-0">
            <button
              onClick={() => setShowCategories(!showCategories)}
              className={`w-full flex items-center justify-between gap-1.5 px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                filters.categoria
                  ? "border-[hsl(var(--green-cta))] text-[hsl(var(--green-cta))] bg-[hsl(var(--green-cta))]/5"
                  : "border-border text-muted-foreground hover:text-foreground bg-background"
              }`}
            >
              <span className="truncate">{activeCategory?.label || "Categoria"}</span>
              <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
            </button>
            {showCategories && (
              <div className="absolute top-full left-0 mt-1 w-full max-h-64 overflow-y-auto rounded-xl bg-card border border-border shadow-lg z-30 py-1">
                <button
                  onClick={() => { onChange({ categoria: null }); setShowCategories(false); }}
                  className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                    !filters.categoria ? "text-[hsl(var(--green-cta))] font-semibold bg-[hsl(var(--green-cta))]/5" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
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
                        ? "text-[hsl(var(--green-cta))] font-semibold bg-[hsl(var(--green-cta))]/5"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        </div>

        {/* Row 2: Price range */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[hsl(var(--green-cta))] text-primary-foreground text-[10px] font-bold flex-shrink-0">2º</span>
            <span className="text-sm font-bold text-[hsl(var(--green-cta))]">Quanto você quer investir?</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {QUICK_PRICES.map(qp => {
              const isActive = filters.precoMin === qp.min && filters.precoMax === qp.max;
              return (
                <div key={qp.label} className="relative">
                  {qp.badge && (
                    <span className="absolute -top-5 left-1/2 -translate-x-1/2 flex items-center gap-0.5 whitespace-nowrap">
                      <Medal className="w-3 h-3 text-amber-500" />
                      <span className="text-[10px] italic text-amber-500 font-medium">mais pedido</span>
                    </span>
                  )}
                  <button
                    onClick={() => handleQuickPrice(qp.min, qp.max)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all duration-200 ${
                      isActive
                        ? "bg-[hsl(var(--green-cta))] text-primary-foreground border-[hsl(var(--green-cta))] shadow-md"
                        : qp.badge
                        ? "border-amber-400/50 text-foreground hover:border-amber-400 bg-background"
                        : "border-border text-foreground hover:border-[hsl(var(--green-cta))]/50 bg-background"
                    }`}
                  >
                    {qp.label}
                  </button>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">R$</span>
              <input
                type="number"
                min={0}
                max={filters.precoMax}
                value={filters.precoMin}
                onChange={e => onChange({ precoMin: Math.max(0, Number(e.target.value)) })}
                className="w-20 px-2 py-1.5 rounded-lg bg-background border border-border text-foreground text-sm text-center focus:outline-none focus:border-[hsl(var(--green-cta))]"
              />
            </div>
            <div className="flex-1">
              <Slider
                min={0}
                max={maxPreco}
                step={5}
                value={[filters.precoMin, filters.precoMax]}
                onValueChange={([min, max]) => onChange({ precoMin: min, precoMax: max })}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">R$</span>
              <input
                type="number"
                min={filters.precoMin}
                max={maxPreco}
                value={filters.precoMax}
                onChange={e => onChange({ precoMax: Math.min(maxPreco, Number(e.target.value)) })}
                className="w-20 px-2 py-1.5 rounded-lg bg-background border border-border text-foreground text-sm text-center focus:outline-none focus:border-[hsl(var(--green-cta))]"
              />
            </div>
          </div>
        </div>

        {/* Row 3: Colors */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[hsl(var(--green-cta))] text-primary-foreground text-[10px] font-bold flex-shrink-0">3º</span>
            <span className="text-sm font-bold text-[hsl(var(--green-cta))]">Qual cor você deseja?</span>
          </div>
          <p className="text-xs text-muted-foreground italic ml-7">Se não tem preferência, basta não selecionar.</p>
          <div className="flex flex-wrap gap-2.5">
            {CATALOG_SWATCH_COLORS.map(swatch => {
              const selected = isSwatchSelected(swatch);
              const isWhite = swatch.bg === "#FFFFFF";
              const isOutros = swatch.name === "OUTROS";
              return (
                <button
                  key={swatch.name}
                  title={swatch.name}
                  onClick={() => handleColorToggle(swatch.name)}
                  className="flex flex-col items-center gap-1 group"
                >
                  <span
                    className="w-10 h-10 rounded-full transition-all duration-150"
                    style={{
                      backgroundColor: isOutros ? undefined : swatch.bg,
                      background: isOutros ? "conic-gradient(#EF4444, #EAB308, #22C55E, #2563EB, #A855F7, #EF4444)" : undefined,
                      border: isWhite ? "2px solid hsl(var(--border))" : "2px solid transparent",
                      boxShadow: selected
                        ? "0 0 0 2px hsl(var(--background)), 0 0 0 4px hsl(142,71%,45%)"
                        : "0 1px 3px rgba(0,0,0,0.15)",
                      transform: selected ? "scale(1.1)" : "scale(1)",
                    }}
                  />
                  <span className={`text-[10px] leading-none max-w-[48px] text-center truncate ${selected ? "text-[hsl(var(--green-cta))] font-semibold" : "text-muted-foreground"}`}>
                    {swatch.name.charAt(0) + swatch.name.slice(1).toLowerCase()}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 4: Search button + Sort */}
        <div className="flex items-center gap-3">
          <Button
            onClick={() => {}}
            className="flex-1 bg-[hsl(var(--green-cta))] text-primary-foreground hover:bg-[hsl(var(--green-cta))]/90 text-base py-3 h-auto font-bold"
          >
            BUSCAR BRINDE
          </Button>
          <div className="relative">
            <select
              value={filters.sort}
              onChange={e => onChange({ sort: e.target.value })}
              className="appearance-none pl-3 pr-8 py-3 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:border-[hsl(var(--green-cta))] cursor-pointer"
            >
              {SORT_OPTIONS.map(o => (
                <option key={o.val} value={o.val}>{o.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Active filter chips + count */}
      <div className="flex items-center gap-2 flex-wrap mb-5">
        <span className="text-sm text-muted-foreground">{totalProducts} produtos encontrados</span>

        {hasFilters && (
          <>
            <span className="text-border">|</span>
            {filters.categoria && activeCategory && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[hsl(var(--green-cta))]/10 text-[hsl(var(--green-cta))] text-xs font-medium">
                {activeCategory.label}
                <button onClick={() => onChange({ categoria: null })}><X className="w-3 h-3" /></button>
              </span>
            )}
            {filters.corValues.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[hsl(var(--green-cta))]/10 text-[hsl(var(--green-cta))] text-xs font-medium">
                {filters.corValues.length} cor(es)
                <button onClick={() => onChange({ corValues: [] })}><X className="w-3 h-3" /></button>
              </span>
            )}
            {(filters.precoMin > 0 || filters.precoMax < maxPreco) && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[hsl(var(--green-cta))]/10 text-[hsl(var(--green-cta))] text-xs font-medium">
                {formatarBRL(filters.precoMin)} – {formatarBRL(filters.precoMax)}
                <button onClick={() => onChange({ precoMin: 0, precoMax: maxPreco })}><X className="w-3 h-3" /></button>
              </span>
            )}
            {filters.search && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[hsl(var(--green-cta))]/10 text-[hsl(var(--green-cta))] text-xs font-medium">
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
