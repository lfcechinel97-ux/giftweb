import { Search } from "lucide-react";
import { Slider } from "@/components/ui/slider";
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
      onChange({ precoMin: 0, precoMax: maxPreco, sort: "relevancia" });
    } else {
      onChange({ precoMin: min, precoMax: max, sort: "maior_preco" });
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

  const stepBadge = (n: string) => (
    <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#22C55E]/15 text-[#22C55E] text-[9px] font-bold flex-shrink-0">
      {n}
    </span>
  );

  return (
    <div className="space-y-4 bg-white border border-[#E5E7EB] rounded-xl p-3.5">
      {/* Search */}
      <div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8]" />
          <input
            type="text"
            placeholder="Buscar produto..."
            value={filters.search}
            onChange={e => onChange({ search: e.target.value })}
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-white border border-[#E5E7EB] text-[#0F172A] text-sm placeholder:text-[#94A3B8] focus:outline-none focus:border-[#22C55E]"
          />
        </div>
      </div>

      <p className="text-xs text-[#94A3B8] text-center">Ou busque por categoria e preço</p>

      {/* Category */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          {stepBadge("1")}
          <span className="text-xs font-semibold text-[#0F172A]">Categoria</span>
        </div>
        <select
          value={filters.categoria || ""}
          onChange={e => onChange({ categoria: e.target.value || null })}
          className="w-full px-3 py-2 rounded-lg bg-white border border-[#E5E7EB] text-[#0F172A] text-sm focus:outline-none focus:border-[#22C55E] cursor-pointer"
        >
          <option value="">Todas as categorias</option>
          {categories.map(cat => (
            <option key={cat.slug} value={cat.slug}>{cat.label}</option>
          ))}
        </select>
      </div>

      {/* Price */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          {stepBadge("2")}
          <span className="text-xs font-semibold text-[#0F172A]">Quanto você quer investir?</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_PRICES.map(qp => {
            const isActive = filters.precoMin === qp.min && filters.precoMax === qp.max;
            return (
              <button
                key={qp.label}
                onClick={() => handleQuickPrice(qp.min, qp.max)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200 ${
                  isActive
                    ? "bg-[#22C55E] text-white border-[#22C55E]"
                    : "border-[#E5E7EB] text-[#475569] hover:border-[#22C55E]/40 bg-[#F1F5F9]"
                }`}
              >
                {qp.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-[#94A3B8]">R$</span>
            <input
              type="number"
              min={0}
              max={filters.precoMax}
              value={filters.precoMin}
              onChange={e => onChange({ precoMin: Math.max(0, Number(e.target.value)) })}
              className="w-14 px-1.5 py-1 rounded-md bg-white border border-[#E5E7EB] text-[#0F172A] text-xs text-center focus:outline-none focus:border-[#22C55E]"
            />
          </div>
          <div className="flex-1 slider-small-thumb catalog-slider">
            <Slider
              min={0}
              max={Math.max(400, filters.precoMax)}
              step={5}
              minStepsBetweenThumbs={1}
              value={[filters.precoMin, filters.precoMax]}
              onValueChange={([min, max]) => onChange({ precoMin: min, precoMax: max })}
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-[#94A3B8]">R$</span>
            <input
              type="number"
              min={filters.precoMin}
              max={maxPreco}
              value={filters.precoMax}
              onChange={e => onChange({ precoMax: Math.min(maxPreco, Number(e.target.value)) })}
              className="w-14 px-1.5 py-1 rounded-md bg-white border border-[#E5E7EB] text-[#0F172A] text-xs text-center focus:outline-none focus:border-[#22C55E]"
            />
          </div>
        </div>
      </div>

      {/* Colors */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          {stepBadge("3")}
          <span className="text-xs font-semibold text-[#0F172A]">Cor</span>
        </div>
        <p className="text-[10px] text-[#94A3B8] italic">Se não tem preferência, basta não selecionar.</p>
        <div className="flex flex-wrap gap-2">
          {CATALOG_SWATCH_COLORS.map(swatch => {
            const selected = isSwatchSelected(swatch);
            const isWhite = swatch.bg === "#FFFFFF";
            const isOutros = swatch.name === "OUTROS";
            return (
              <button
                key={swatch.name}
                onClick={() => handleColorToggle(swatch.name)}
                className="flex flex-col items-center gap-0.5"
              >
                <span
                  className="block w-6 h-6 rounded-full transition-all duration-150"
                  style={{
                    background: isOutros ? "conic-gradient(#EF4444, #EAB308, #22C55E, #2563EB, #A855F7, #EF4444)" : swatch.bg,
                    border: isWhite ? "1.5px solid #D1D5DB" : "1.5px solid transparent",
                    boxShadow: selected
                      ? "0 0 0 1.5px white, 0 0 0 3px #22C55E"
                      : "none",
                    transform: selected ? "scale(1.1)" : "scale(1)",
                  }}
                />
                <span className={`text-[8px] leading-none max-w-[36px] text-center truncate ${selected ? "text-[#22C55E] font-semibold" : "text-[#94A3B8]"}`}>
                  {swatch.name.charAt(0) + swatch.name.slice(1).toLowerCase()}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Search button */}
      <div>
        <button
          onClick={() => {}}
          className="w-full bg-[#22C55E] text-white hover:bg-[#16A34A] text-sm py-2.5 rounded-lg font-semibold transition-colors"
        >
          BUSCAR BRINDE
        </button>
        <p className="text-[10px] text-[#94A3B8] text-center mt-1.5">
          Você verá os melhores modelos para seu orçamento
        </p>
      </div>
    </div>
  );
};

export default CatalogMobileFilters;
