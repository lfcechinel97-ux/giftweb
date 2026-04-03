import { ShoppingBag } from "lucide-react";
import { useQuotation } from "@/contexts/QuotationContext";

const QuotationBar = () => {
  const { totalItems, setIsOpen } = useQuotation();

  if (totalItems === 0) return null;

  return (
    <button
      onClick={() => setIsOpen(true)}
      className="fixed bottom-24 right-5 z-40 flex items-center gap-2 bg-green-cta text-primary-foreground px-4 py-3 rounded-full shadow-lg hover:brightness-110 transition-all"
      style={{ boxShadow: "0 4px 20px rgba(34,197,94,0.4)" }}
    >
      <ShoppingBag className="w-5 h-5" />
      <span className="font-bold text-sm">{totalItems} {totalItems === 1 ? "item" : "itens"}</span>
    </button>
  );
};

export default QuotationBar;
