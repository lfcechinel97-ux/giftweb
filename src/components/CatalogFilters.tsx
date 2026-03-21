import { useState } from "react";
import { Search, X, Filter, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { getCorHex, isLightColor } from "@/utils/colorHex";

interface CatalogFiltersProps {
  searchTerm: string;
  onSearchChange: (val: string) => void;
  cores: string[];
  selectedCor: string | null;
  onCorChange: (cor: string | null) => void;
  precoRange: [number, number];
  onPrecoRangeChange: (range: [number, number]) => void;
  maxPreco: number;
  apenasEstoque: boolean;
  onApenasEstoqueChange: (val: boolean) => void;
  onClearFilters: () => void;
  totalProducts: number;
  sortBy?: string;
  onSortChange?: (val: string) => void;
}

const SORT_OPTIONS = [
  { val: "relevancia", label: "Mais relevantes" },
  { val: "menor_preco", label: "Menor preço" },
  { val: "maior_preco", label: "Maior preço" },
  { val: "maior_estoque", label: "Maior estoque" },
  { val: "az", label: "A → Z" },
];

const CatalogFilters = ({
  searchTerm,
  onSearchChange,
  cores,
  selectedCor,
  onCorChange,
  apenasEstoque,
  onApenasEstoqueChange,
  onClearFilters,
  totalProducts,
  sortBy = "relevancia",
  onSortChange,
}: CatalogFiltersProps) => {
  const [open, setOpen] = useState(false);

  const hasFilters = !!(searchTerm || selectedCor || apenasEstoque);
  const currentSort = SORT_OPTIONS.find((o) => o.val === sortBy) || SORT_OPTIONS[0];

  return (
    <div className="mb-6 space-y-3">
      {/* Top bar: search + sort + filter toggle */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar nesta categoria..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-card border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-green-cta focus:ring-2 focus:ring-green-cta/15 transition-colors"
          />
          {searchTerm && (
            <button onClick={() => onSearchChange("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Sort select */}
          {onSortChange && (
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => onSortChange(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2.5 rounded-lg bg-card border border-border text-foreground text-sm focus:outline-none focus:border-green-cta focus:ring-2 focus:ring-green-cta/15 transition-colors cursor-pointer"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.val} value={o.val}>{o.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            </div>
          )}

          {/* Filter toggle */}
          <button
            onClick={() => setOpen(!open)}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-lg border text-sm transition-colors ${
              open || hasFilters
                ? "border-green-cta text-green-cta bg-green-cta/5"
                : "border-border text-muted-foreground hover:text-foreground hover:border-border/80 bg-card"
            }`}
          >
            <Filter className="w-4 h-4" />
            <span className="hidden sm:inline">Filtros</span>
            {hasFilters && (
              <span className="w-1.5 h-1.5 rounded-full bg-green-cta" />
            )}
          </button>

          <span className="text-sm text-muted-foreground hidden md:block whitespace-nowrap">
            {totalProducts} produtos
          </span>
        </div>
      </div>

      {/* Mobile count */}
      <p className="text-xs text-muted-foreground md:hidden">{totalProducts} produtos encontrados</p>

      {/* Expanded filters panel */}
      {open && (
        <div className="p-4 rounded-xl bg-card border border-border space-y-5">
          {/* Color swatches */}
          {cores.length > 0 && (
            <div>
              <span className="text-sm font-semibold text-foreground mb-3 block">Cor</span>
              <div className="flex flex-wrap gap-2">
                {cores.map((c) => {
                  const hex = getCorHex(c);
                  const light = isLightColor(hex);
                  const isSelected = selectedCor === c;
                  return (
                    <button
                      key={c}
                      title={c}
                      onClick={() => onCorChange(isSelected ? null : c)}
                      className="relative flex flex-col items-center gap-1 group"
                    >
                      <span
                        className="w-8 h-8 rounded-full transition-all duration-150"
                        style={{
                          backgroundColor: hex,
                          border: light
                            ? "1.5px solid hsl(var(--border))"
                            : "1.5px solid transparent",
                          boxShadow: isSelected
                            ? "0 0 0 2px hsl(var(--background)), 0 0 0 4px hsl(82,84%,55%)"
                            : "0 1px 3px rgba(0,0,0,0.15)",
                          transform: isSelected ? "scale(1.15)" : "scale(1)",
                        }}
                      />
                      <span
                        className={`text-[10px] leading-none max-w-[40px] text-center truncate transition-colors ${
                          isSelected ? "text-green-cta font-semibold" : "text-muted-foreground"
                        }`}
                      >
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
            <Switch checked={apenasEstoque} onCheckedChange={onApenasEstoqueChange} />
            <span className="text-sm text-muted-foreground">Apenas com estoque disponível</span>
          </div>

          {hasFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearFilters}
              className="border-green-cta text-green-cta hover:bg-green-cta hover:text-primary-foreground"
            >
              <X className="w-3 h-3 mr-1" /> Limpar filtros
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default CatalogFilters;
