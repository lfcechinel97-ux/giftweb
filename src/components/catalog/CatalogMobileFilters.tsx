import { useState } from "react";
import { X, Search, Filter } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { getCorHex, isLightColor } from "@/utils/colorHex";
import { useBaseCategories } from "@/hooks/useBaseCategories";

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
  const [open, setOpen] = useState(false);
  const { data: categories = [] } = useBaseCategories();
  const hasFilters = !!(filters.search || filters.categoria || filters.corValues.length > 0 || filters.apenasEstoque || filters.precoMin > 0 || filters.precoMax < maxPreco);

  return (
    <>
      {/* Trigger button — mobile only */}
      <button
        onClick={() => setOpen(true)}
        className="lg:hidden flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-card text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <Filter className="w-4 h-4" />
        Filtrar
        {hasFilters && <span className="w-2 h-2 rounded-full bg-green-cta" />}
      </button>

      {/* Fullscreen modal */}
      {open && (
        <div className="fixed inset-0 z-[100] bg-background flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="font-bold text-lg text-foreground">Filtros</h2>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
            {/* Search */}
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

            {/* Sort */}
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">Ordenar por</label>
              <select
                value={filters.sort}
                onChange={e => onChange({ sort: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg bg-card border border-border text-foreground text-sm"
              >
                {SORT_OPTIONS.map(o => (
                  <option key={o.val} value={o.val}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Categories */}
            <div>
              <label className="text-sm font-semibold text-foreground mb-2 block">Categoria</label>
              <div className="grid grid-cols-2 gap-1.5">
                {categories.map(cat => (
                  <button
                    key={cat.slug}
                    onClick={() => onChange({ categoria: filters.categoria === cat.slug ? null : cat.slug })}
                    className={`text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      filters.categoria === cat.slug
                        ? "bg-green-cta/10 text-green-cta font-semibold border border-green-cta/30"
                        : "text-muted-foreground bg-card border border-border"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Price */}
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
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  value={filters.precoMin}
                  onChange={e => onChange({ precoMin: Math.max(0, Number(e.target.value)) })}
                  className="flex-1 px-2 py-1.5 rounded-lg bg-card border border-border text-foreground text-sm text-center"
                />
                <span className="text-muted-foreground text-xs">até</span>
                <input
                  type="number"
                  min={0}
                  value={filters.precoMax}
                  onChange={e => onChange({ precoMax: Math.min(maxPreco, Number(e.target.value)) })}
                  className="flex-1 px-2 py-1.5 rounded-lg bg-card border border-border text-foreground text-sm text-center"
                />
              </div>
            </div>

            {/* Colors */}
            {cores.length > 0 && (
              <div>
                <label className="text-sm font-semibold text-foreground mb-3 block">Cor</label>
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
                          className="w-8 h-8 rounded-full"
                          style={{
                            backgroundColor: hex,
                            border: light ? "1.5px solid hsl(var(--border))" : "1.5px solid transparent",
                            boxShadow: isSelected ? "0 0 0 2px hsl(var(--background)), 0 0 0 4px hsl(142,71%,45%)" : "0 1px 3px rgba(0,0,0,0.15)",
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

            {/* Stock */}
            <div className="flex items-center gap-3">
              <Switch checked={filters.apenasEstoque} onCheckedChange={v => onChange({ apenasEstoque: v })} />
              <span className="text-sm text-muted-foreground">Apenas com estoque</span>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-border px-5 py-4 flex gap-3">
            {hasFilters && (
              <Button variant="outline" onClick={onClear} className="flex-1 border-border text-muted-foreground">
                Limpar
              </Button>
            )}
            <Button onClick={() => { onApply(); setOpen(false); }} className="flex-1 bg-green-cta hover:bg-green-cta/90 text-primary-foreground font-bold">
              Ver {totalProducts} produtos
            </Button>
          </div>
        </div>
      )}
    </>
  );
};

export default CatalogMobileFilters;
