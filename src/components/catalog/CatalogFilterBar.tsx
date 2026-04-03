import { useState } from "react";
import { Search, X, ChevronDown } from "lucide-react";
import { Slider } from "@/components/ui/slider";
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
  { label: "Até R$30", min: 10.01, max: 30 },
  { label: "Até R$50", min: 30.01, max: 50 },
  { label: "Até R$100", min: 50.01, max: 100 },
  { label: "Até R$200", min: 100.01, max: 200 },
  { label: "Até R$400", min: 200.01, max: 400 },
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
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#22C55E]/15 text-[#22C55E] text-[10px] font-bold flex-shrink-0">
      {n}
    </span>
  );

  return (
    <div id="catalog-products" className="scroll-mt-20">
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 mb-3 space-y-4">
        {/* Row 1: Category + Search */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            {stepBadge("1")}
            <span className="text-xs font-semibold text-[#0F172A]">Selecione a categoria</span>
          </div>
          <div className="flex gap-3">
            <div className="relative flex-[2] min-w-0">
              <button
                onClick={() => setShowCategories(!showCategories)}
                className={`w-full flex items-center justify-between gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors ${
                  filters.categoria
                    ? "border-[#22C55E] text-[#22C55E] bg-[#22C55E]/5"
                    : "border-[#E5E7EB] text-[#64748B] hover:text-[#0F172A] bg-white"
                }`}
              >
                <span className="truncate">{activeCategory?.label || "Categoria"}</span>
                <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
              </button>
              {showCategories && (
                <div className="absolute top-full left-0 mt-1 w-full max-h-64 overflow-y-auto rounded-lg bg-white border border-[#E5E7EB] shadow-lg z-30 py-1">
                  <button
                    onClick={() => { onChange({ categoria: null }); setShowCategories(false); }}
                    className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
                      !filters.categoria ? "text-[#22C55E] font-medium bg-[#22C55E]/5" : "text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]"
                    }`}
                  >
                    Todas
                  </button>
                  {categories.map(cat => (
                    <button
                      key={cat.slug}
                      onClick={() => { onChange({ categoria: cat.slug }); setShowCategories(false); }}
                      className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
                        filters.categoria === cat.slug
                          ? "text-[#22C55E] font-medium bg-[#22C55E]/5"
                          : "text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC]"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative flex-[3] min-w-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#94A3B8]" />
              <input
                type="text"
                placeholder="Buscar produto..."
                value={filters.search}
                onChange={e => onChange({ search: e.target.value })}
                className="w-full pl-9 pr-8 py-2 rounded-lg bg-white border border-[#E5E7EB] text-[#0F172A] text-sm placeholder:text-[#94A3B8] focus:outline-none focus:border-[#22C55E] transition-colors"
              />
              {filters.search && (
                <button onClick={() => onChange({ search: "" })} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="w-3 h-3 text-[#94A3B8] hover:text-[#0F172A]" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Row 2: Price range */}
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
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-[#94A3B8]">R$</span>
              <input
                type="number"
                min={0}
                max={filters.precoMax}
                value={filters.precoMin}
                onChange={e => onChange({ precoMin: Math.max(0, Number(e.target.value)) })}
                className="w-16 px-2 py-1 rounded-md bg-white border border-[#E5E7EB] text-[#0F172A] text-xs text-center focus:outline-none focus:border-[#22C55E]"
              />
            </div>
            <div className="flex-1 catalog-slider">
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
                className="w-16 px-2 py-1 rounded-md bg-white border border-[#E5E7EB] text-[#0F172A] text-xs text-center focus:outline-none focus:border-[#22C55E]"
              />
            </div>
          </div>
        </div>

        {/* Row 3: Colors */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            {stepBadge("3")}
            <span className="text-xs font-semibold text-[#0F172A]">Qual cor você deseja?</span>
            <span className="text-[10px] text-[#94A3B8] italic ml-1">Se não tem preferência, basta não selecionar.</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {CATALOG_SWATCH_COLORS.map(swatch => {
              const selected = isSwatchSelected(swatch);
              const isWhite = swatch.bg === "#FFFFFF";
              const isOutros = swatch.name === "OUTROS";
              return (
                <button
                  key={swatch.name}
                  title={swatch.name}
                  onClick={() => handleColorToggle(swatch.name)}
                  className="flex flex-col items-center gap-0.5 group"
                >
                  <span
                    className="block w-7 h-7 rounded-full transition-all duration-150"
                    style={{
                      background: isOutros ? "conic-gradient(#EF4444, #EAB308, #22C55E, #2563EB, #A855F7, #EF4444)" : swatch.bg,
                      border: isWhite ? "1.5px solid #D1D5DB" : "1.5px solid transparent",
                      boxShadow: selected
                        ? "0 0 0 2px white, 0 0 0 3.5px #22C55E"
                        : "none",
                      transform: selected ? "scale(1.08)" : "scale(1)",
                    }}
                  />
                  <span className={`text-[9px] leading-none max-w-[40px] text-center truncate ${selected ? "text-[#22C55E] font-semibold" : "text-[#94A3B8]"}`}>
                    {swatch.name.charAt(0) + swatch.name.slice(1).toLowerCase()}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 4: Search button + Sort */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={() => {}}
            className="flex-1 bg-[#22C55E] text-white hover:bg-[#16A34A] text-sm py-2.5 rounded-lg font-semibold transition-colors"
          >
            BUSCAR BRINDE
          </button>
          <div className="relative">
            <select
              value={filters.sort}
              onChange={e => onChange({ sort: e.target.value })}
              className="appearance-none pl-3 pr-7 py-2.5 rounded-lg bg-white border border-[#E5E7EB] text-[#475569] text-xs focus:outline-none focus:border-[#22C55E] cursor-pointer"
            >
              {SORT_OPTIONS.map(o => (
                <option key={o.val} value={o.val}>{o.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#94A3B8] pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Active filter chips */}
      {hasFilters && (
        <div className="flex items-center gap-1.5 flex-wrap mb-4">
          {filters.categoria && activeCategory && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#22C55E]/10 text-[#22C55E] text-[11px] font-medium">
              {activeCategory.label}
              <button onClick={() => onChange({ categoria: null })}><X className="w-2.5 h-2.5" /></button>
            </span>
          )}
          {filters.corValues.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#22C55E]/10 text-[#22C55E] text-[11px] font-medium">
              {filters.corValues.length} cor(es)
              <button onClick={() => onChange({ corValues: [] })}><X className="w-2.5 h-2.5" /></button>
            </span>
          )}
          {(filters.precoMin > 0 || filters.precoMax < maxPreco) && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#22C55E]/10 text-[#22C55E] text-[11px] font-medium">
              {formatarBRL(filters.precoMin)} – {formatarBRL(filters.precoMax)}
              <button onClick={() => onChange({ precoMin: 0, precoMax: maxPreco })}><X className="w-2.5 h-2.5" /></button>
            </span>
          )}
          {filters.search && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#22C55E]/10 text-[#22C55E] text-[11px] font-medium">
              "{filters.search}"
              <button onClick={() => onChange({ search: "" })}><X className="w-2.5 h-2.5" /></button>
            </span>
          )}
          <button onClick={onClear} className="text-[11px] text-[#94A3B8] hover:text-[#0F172A] underline ml-1">
            Limpar tudo
          </button>
        </div>
      )}
    </div>
  );
};

export default CatalogFilterBar;
