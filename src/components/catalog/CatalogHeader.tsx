import { ShoppingCart } from "lucide-react";
import { useQuotation } from "@/contexts/QuotationContext";

const CatalogHeader = () => {
  const { totalItems, setIsOpen } = useQuotation();

  return (
    <header className="w-full bg-[#0B0F1A] border-b border-white/10">
      <div className="container flex items-center justify-between py-4">
        <a href="/catalogo" className="flex items-center gap-2">
          <span className="text-xl md:text-2xl font-bold text-white tracking-tight">
            Catálogo Digital
          </span>
          <span className="text-xl md:text-2xl font-bold text-[hsl(var(--green-cta))] tracking-tight">
            Gift Web
          </span>
        </a>

        <button
          onClick={() => setIsOpen(true)}
          className="relative flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white transition-colors"
        >
          <ShoppingCart className="w-5 h-5" />
          <span className="text-sm font-medium hidden sm:inline">Orçamento</span>
          {totalItems > 0 && (
            <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-[hsl(var(--green-cta))] text-white text-xs font-bold flex items-center justify-center animate-in zoom-in duration-200">
              {totalItems}
            </span>
          )}
        </button>
      </div>
    </header>
  );
};

export default CatalogHeader;
