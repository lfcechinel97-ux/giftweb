import { Search, X } from "lucide-react";
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

interface CatalogSidebarProps {
  filters: Filters;
  onChange: (partial: Partial<Filters>) => void;
  onClear: () => void;
  cores: string[];
  maxPreco: number;
}

const SORT_OPTIONS = [
  { val: "relevancia", label: "Mais relevantes" },
  { val: "menor_preco", label: "Menor preço" },
  { val: "maior_preco", label: "Maior preço" },
  { val: "maior_estoque", label: "Maior estoque" },
  { val: "az", label: "A → Z" },
];

const CatalogSidebar = ({ filters, onChange, onClear, cores, maxPreco }: CatalogSidebarProps) => {
  const { data: categories = [] } = useBaseCategories();
  const hasFilters = !!(filters.search || filters.categoria || filters.corValues.length > 0 || filters.apenasEstoque || filters.precoMin > 0 || filters.precoMax < maxPreco);

  return (
    <aside className="hidden lg:block w-[300px] shrink-0">
      <div className="sticky top-24 space-y-6 bg-card border border-border rounded-2xl p-5">
        <h3 className="font-bold text-foreground text-base">Filtros</h3>

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
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-background border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-green-cta focus:ring-2 focus:ring-green-cta/15 transition-colors"
            />
            {filters.search && (
              <button onClick={() => onChange({ search: "" })} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>
        </div>

        {/* Sort */}
        <div>
          <label className="text-sm font-semibold text-foreground mb-2 block">Ordenar por</label>
          <select
            value={filters.sort}
            onChange={e => onChange({ sort: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm focus:outline-none focus:border-green-cta cursor-pointer"
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.val} value={o.val}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Categories */}
        <div>
          <label className="text-sm font-semibold text-foreground mb-2 block">Categoria</label>
          <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
            {categories.map(cat => (
              <button
                key={cat.slug}
                onClick={() => onChange({ categoria: filters.categoria === cat.slug ? null : cat.slug })}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  filters.categoria === cat.slug
                    ? "bg-green-cta/10 text-green-cta font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Price range */}
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
            <div className="flex-1">
              <input
                type="number"
                min={0}
                max={filters.precoMax}
                value={filters.precoMin}
                onChange={e => onChange({ precoMin: Math.max(0, Number(e.target.value)) })}
                className="w-full px-2 py-1.5 rounded-lg bg-background border border-border text-foreground text-sm text-center focus:outline-none focus:border-green-cta"
              />
            </div>
            <span className="text-muted-foreground text-xs">até</span>
            <div className="flex-1">
              <input
                type="number"
                min={filters.precoMin}
                max={maxPreco}
                value={filters.precoMax}
                onChange={e => onChange({ precoMax: Math.min(maxPreco, Number(e.target.value)) })}
                className="w-full px-2 py-1.5 rounded-lg bg-background border border-border text-foreground text-sm text-center focus:outline-none focus:border-green-cta"
              />
            </div>
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
                    className="relative flex flex-col items-center gap-1"
                  >
                    <span
                      className="w-7 h-7 rounded-full transition-all duration-150"
                      style={{
                        backgroundColor: hex,
                        border: light ? "1.5px solid hsl(var(--border))" : "1.5px solid transparent",
                        boxShadow: isSelected ? "0 0 0 2px hsl(var(--background)), 0 0 0 4px hsl(142,71%,45%)" : "0 1px 3px rgba(0,0,0,0.15)",
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

        {/* Stock toggle */}
        <div className="flex items-center gap-3">
          <Switch checked={filters.apenasEstoque} onCheckedChange={v => onChange({ apenasEstoque: v })} />
          <span className="text-sm text-muted-foreground">Apenas com estoque</span>
        </div>

        {hasFilters && (
          <Button variant="outline" size="sm" onClick={onClear} className="w-full border-green-cta text-green-cta hover:bg-green-cta hover:text-primary-foreground">
            <X className="w-3 h-3 mr-1" /> Limpar filtros
          </Button>
        )}
      </div>
    </aside>
  );
};

export default CatalogSidebar;
