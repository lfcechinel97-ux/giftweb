import { useState } from "react";
import { X, Search, SlidersHorizontal } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
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

interface CatalogMobileFiltersProps {
  filters: Filters;
  onChange: (partial: Partial<Filters>) => void;
  onClear: () => void;
  onApply: () => void;
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

const CatalogMobileFilters = ({ filters, onChange, onClear, onApply, cores, maxPreco, totalProducts }: CatalogMobileFiltersProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const { data: categories = [] } = useBaseCategories();

  const hasFilters = !!(
    filters.search ||
    filters.categoria ||
    filters.corValues.length > 0 ||
    filters.precoMin > 0 ||
    filters.precoMax < maxPreco
  );

  const handleApply = () => {
    setIsOpen(false);
    onApply();
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
          hasFilters
            ? "border-green-cta text-green-cta bg-green-cta/5"
            : "border-border text-muted-foreground bg-card"
        }`}
      >
        <SlidersHorizontal className="w-4 h-4" />
        Filtrar
        {hasFilters && <span className="w-1.5 h-1.5 rounded-full bg-green-cta" />}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[100] bg-background flex flex-col animate-fade-in">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="text-lg font-bold text-foreground">Filtrar brindes</h2>
            <button onClick={() => setIsOpen(false)}>
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Nome do produto..."
                  value={filters.search}
                  onChange={e => onChange({ search: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-card border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-green-cta"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">Ordenar por</label>
              <select
                value={filters.sort}
                onChange={e => onChange({ sort: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg bg-card border border-border text-foreground text-sm focus:outline-none focus:border-green-cta cursor-pointer"
              >
                {SORT_OPTIONS.map(o => (
                  <option key={o.val} value={o.val}>{o.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">Categoria</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => onChange({ categoria: null })}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    !filters.categoria
                      ? "border-green-cta text-green-cta bg-green-cta/10 font-semibold"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  Todas
                </button>
                {categories.map(cat => (
                  <button
                    key={cat.slug}
                    onClick={() => onChange({ categoria: filters.categoria === cat.slug ? null : cat.slug })}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      filters.categoria === cat.slug
                        ? "border-green-cta text-green-cta bg-green-cta/10 font-semibold"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-foreground mb-3 block">Faixa de preço</label>
              <Slider
                min={0}
                max={maxPreco}
                step={5}
                value={[filters.precoMin, filters.precoMax]}
                onValueChange={([min, max]) => onChange({ precoMin: min, precoMax: max })}
                className="mb-3"
              />
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{formatarBRL(filters.precoMin)}</span>
                <span>{formatarBRL(filters.precoMax)}</span>
              </div>
            </div>

            {cores.length > 0 && (
              <div>
                <label className="text-sm font-semibold text-foreground mb-3 block">Cor</label>
                <div className="flex flex-wrap gap-3">
                  {cores.map(c => {
                    const hex = getCorHex(c);
                    const light = isLightColor(hex);
                    const isSelected = filters.corValues.includes(c);
                    return (
                      <button
                        key={c}
                        onClick={() => {
                          const next = isSelected
                            ? filters.corValues.filter(v => v !== c)
                            : [...filters.corValues, c];
                          onChange({ corValues: next });
                        }}
                        className="flex flex-col items-center gap-1"
                      >
                        <span
                          className="w-8 h-8 rounded-full transition-all duration-150"
                          style={{
                            backgroundColor: hex,
                            border: light ? "1.5px solid hsl(var(--border))" : "1.5px solid transparent",
                            boxShadow: isSelected
                              ? "0 0 0 2px hsl(var(--background)), 0 0 0 4px hsl(142,71%,45%)"
                              : "0 1px 3px rgba(0,0,0,0.15)",
                            transform: isSelected ? "scale(1.15)" : "scale(1)",
                          }}
                        />
                        <span className={`text-[10px] max-w-[40px] text-center truncate ${isSelected ? "text-green-cta font-semibold" : "text-muted-foreground"}`}>
                          {c.charAt(0).toUpperCase() + c.slice(1).toLowerCase()}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="px-5 py-4 border-t border-border flex gap-3">
            {hasFilters && (
              <Button variant="outline" onClick={onClear} className="flex-1 border-border">
                Limpar
              </Button>
            )}
            <Button onClick={handleApply} className="flex-1 bg-green-cta text-primary-foreground hover:bg-green-cta/90">
              Ver {totalProducts} resultados
            </Button>
          </div>
        </div>
      )}
    </>
  );
};

export default CatalogMobileFilters;
