import { Search } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { useBaseCategories } from "@/hooks/useBaseCategories";
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

interface CatalogMobileFiltersProps {
  filters: Filters;
  onChange: (partial: Partial<Filters>) => void;
  onClear: () => void;
  onApply: () => void;
  cores: string[];
  maxPreco: number;
  totalProducts: number;
}

const QUICK_PRICES = [
  { label: "Até R$10", min: 0, max: 10 },
  { label: "Até R$30", min: 10.01, max: 30 },
  { label: "Até R$50", min: 30.01, max: 50 },
  { label: "Até R$100", min: 50.01, max: 100 },
  { label: "Até R$200", min: 100.01, max: 200 },
  { label: "Até R$400", min: 200.01, max: 400 },
];

const CatalogMobileFilters = ({ filters, onChange, onClear, maxPreco }: CatalogMobileFiltersProps) => {
  const { data: categories = [] } = useBaseCategories();

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
    <div className="space-y-5 bg-card border border-border rounded-xl p-4">
      {/* Search */}
      <div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar produto..."
            value={filters.search}
            onChange={e => onChange({ search: e.target.value })}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-[hsl(var(--green-cta))]"
          />
        </div>
      </div>

      {/* Separator text */}
      <p className="text-sm text-muted-foreground text-center">Ou busque por categoria e preço</p>

      {/* Category — always visible, native select */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-foreground block">Categoria</label>
        <select
          value={filters.categoria || ""}
          onChange={e => onChange({ categoria: e.target.value || null })}
          className="w-full px-3 py-2.5 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:border-[hsl(var(--green-cta))] cursor-pointer"
        >
          <option value="">Todas as categorias</option>
          {categories.map(cat => (
            <option key={cat.slug} value={cat.slug}>{cat.label}</option>
          ))}
        </select>
      </div>

      {/* Price — always visible */}
      <div className="space-y-3">
        <label className="text-sm font-semibold text-foreground block">Quanto você quer investir?</label>
        <div className="flex flex-wrap gap-2">
          {QUICK_PRICES.map(qp => {
            const isActive = filters.precoMin === qp.min && filters.precoMax === qp.max;
            return (
              <button
                key={qp.label}
                onClick={() => handleQuickPrice(qp.min, qp.max)}
                className={`px-3.5 py-2 rounded-lg text-sm font-medium border transition-all duration-200 ${
                  isActive
                    ? "bg-[hsl(var(--green-cta))] text-primary-foreground border-[hsl(var(--green-cta))] shadow-md"
                    : "border-border text-foreground hover:border-[hsl(var(--green-cta))]/50 bg-background"
                }`}
              >
                {qp.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">R$</span>
            <input
              type="number"
              min={0}
              max={filters.precoMax}
              value={filters.precoMin}
              onChange={e => onChange({ precoMin: Math.max(0, Number(e.target.value)) })}
              className="w-16 px-2 py-1.5 rounded-lg bg-background border border-border text-foreground text-sm text-center focus:outline-none focus:border-[hsl(var(--green-cta))]"
            />
          </div>
          <div className="flex-1 slider-small-thumb">
            <Slider
              min={0}
              max={Math.max(70, filters.precoMax)}
              step={5}
              value={[filters.precoMin, filters.precoMax]}
              onValueChange={([min, max]) => onChange({ precoMin: min, precoMax: max })}
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">R$</span>
            <input
              type="number"
              min={filters.precoMin}
              max={maxPreco}
              value={filters.precoMax}
              onChange={e => onChange({ precoMax: Math.min(maxPreco, Number(e.target.value)) })}
              className="w-16 px-2 py-1.5 rounded-lg bg-background border border-border text-foreground text-sm text-center focus:outline-none focus:border-[hsl(var(--green-cta))]"
            />
          </div>
        </div>
      </div>

      {/* Colors — always visible */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-foreground block">Qual cor você deseja?</label>
        <p className="text-xs text-muted-foreground italic">Se não tem preferência, basta não selecionar.</p>
        <div className="flex flex-wrap gap-2.5">
          {CATALOG_SWATCH_COLORS.map(swatch => {
            const selected = isSwatchSelected(swatch);
            const isWhite = swatch.bg === "#FFFFFF";
            const isOutros = swatch.name === "OUTROS";
            return (
              <button
                key={swatch.name}
                onClick={() => handleColorToggle(swatch.name)}
                className="flex flex-col items-center gap-1"
              >
                <span
                  className="block w-8 h-8 rounded-full transition-all duration-150"
                  style={{
                    background: isOutros ? "conic-gradient(#EF4444, #EAB308, #22C55E, #2563EB, #A855F7, #EF4444)" : swatch.bg,
                    border: isWhite ? "2px solid hsl(var(--border))" : "2px solid transparent",
                    boxShadow: selected
                      ? "0 0 0 2px hsl(var(--background)), 0 0 0 4px hsl(142,71%,45%)"
                      : "0 1px 3px rgba(0,0,0,0.15)",
                    transform: selected ? "scale(1.1)" : "scale(1)",
                  }}
                />
                <span className={`text-[9px] leading-none max-w-[40px] text-center truncate ${selected ? "text-[hsl(var(--green-cta))] font-semibold" : "text-muted-foreground"}`}>
                  {swatch.name.charAt(0) + swatch.name.slice(1).toLowerCase()}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Search button */}
      <Button
        onClick={() => {}}
        className="w-full bg-[hsl(var(--green-cta))] text-primary-foreground hover:bg-[hsl(var(--green-cta))]/90 text-base py-3 h-auto font-bold"
      >
        BUSCAR BRINDE
      </Button>
    </div>
  );
};

export default CatalogMobileFilters;
