import { useState } from "react";
import { Search, X, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

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
  showSort?: boolean;
}

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
  sortBy,
  onSortChange,
  showSort = false,
}: CatalogFiltersProps) => {
  const [open, setOpen] = useState(false);

  const hasFilters = searchTerm || selectedCor || apenasEstoque;

  return (
    <div className="mb-6 space-y-4">
      {/* Search + toggle */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar produtos..."
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
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">{totalProducts} produtos encontrados</span>
          <button onClick={() => setOpen(!open)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <Filter className="w-4 h-4" /> Filtros
          </button>
        </div>
      </div>

      {/* Expanded filters */}
      {open && (
        <div className="p-4 rounded-xl bg-card border border-border space-y-4">
          {/* Cores */}
          {cores.length > 0 && (
            <div>
              <span className="text-sm font-semibold text-foreground mb-2 block">Cor</span>
              <div className="flex flex-wrap gap-2">
                {cores.map((c) => (
                  <button
                    key={c}
                    onClick={() => onCorChange(selectedCor === c ? null : c)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      selectedCor === c
                        ? "bg-green-cta text-primary-foreground border-green-cta"
                        : "bg-secondary text-muted-foreground border-border hover:border-green-cta"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Estoque toggle */}
          <div className="flex items-center gap-3">
            <Switch checked={apenasEstoque} onCheckedChange={onApenasEstoqueChange} />
            <span className="text-sm text-muted-foreground">Apenas em estoque</span>
          </div>

          {/* Sort */}
          {showSort && onSortChange && (
            <div>
              <span className="text-sm font-semibold text-foreground mb-2 block">Ordenar por</span>
              <div className="flex gap-2">
                {[
                  { val: "relevancia", label: "Relevância" },
                  { val: "menor_preco", label: "Menor preço" },
                  { val: "maior_estoque", label: "Maior estoque" },
                ].map((o) => (
                  <button
                    key={o.val}
                    onClick={() => onSortChange(o.val)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      sortBy === o.val
                        ? "bg-green-cta text-primary-foreground border-green-cta"
                        : "bg-secondary text-muted-foreground border-border hover:border-green-cta"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {hasFilters && (
            <Button variant="outline" size="sm" onClick={onClearFilters} className="border-green-cta text-green-cta hover:bg-green-cta hover:text-primary-foreground">
              <X className="w-3 h-3 mr-1" /> Limpar filtros
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default CatalogFilters;
