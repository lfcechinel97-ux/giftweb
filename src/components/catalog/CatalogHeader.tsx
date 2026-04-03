import { ShoppingCart } from "lucide-react";
import { useQuotation } from "@/contexts/QuotationContext";

const CatalogHeader = () => {
  const { totalItems, setIsOpen } = useQuotation();

  return (
    <header className="w-full bg-[#0B0F1A] border-b border-white/5">
      <div className="container flex items-center justify-between py-2.5">
        <a href="/catalogo" className="flex items-center gap-1">
          <span className="text-xl md:text-2xl font-black italic text-white tracking-tight" style={{ fontFamily: "'Georgia', serif" }}>
            Gift Web
          </span>
          <span className="text-[10px] md:text-xs font-semibold text-[#22C55E] tracking-[0.15em] uppercase self-end mb-0.5">
            BRINDES
          </span>
        </a>

        <button
          onClick={() => setIsOpen(true)}
          className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-white/80 transition-colors text-sm"
        >
          <ShoppingCart className="w-4 h-4" />
          <span className="font-medium hidden sm:inline">Orçamento</span>
          {totalItems > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[#22C55E] text-white text-[10px] font-semibold flex items-center justify-center">
              {totalItems}
            </span>
          )}
        </button>
      </div>
    </header>
  );
};

export default CatalogHeader;
