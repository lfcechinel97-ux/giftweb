import { ShoppingCart } from "lucide-react";
import { useQuotation } from "@/contexts/QuotationContext";
import QuotationDrawer from "@/components/catalog/QuotationDrawer";

/**
 * Botão flutuante do carrinho de orçamento (canto inferior direito), no lugar
 * do antigo botão de WhatsApp. O cliente adiciona produtos ao carrinho e, ao
 * abrir o carrinho, finaliza no WhatsApp com itens, quantidades e valores —
 * o mesmo fluxo do /catalogo-clientes.
 */
const CartFab = () => {
  const { totalItems, isOpen, setIsOpen } = useQuotation();
  const vazio = totalItems === 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`fixed right-4 z-[90] ${isOpen ? "hidden" : "flex"} items-center justify-center gap-2 rounded-full bg-green-cta text-white font-bold transition-transform duration-200 hover:scale-105 active:scale-95 ${
          vazio ? "w-14 h-14" : "h-14 pl-4 pr-3"
        }`}
        style={{
          bottom: "calc(1.25rem + env(safe-area-inset-bottom))",
          boxShadow: "0 4px 24px rgba(34,197,94,0.45)",
        }}
        aria-label={vazio ? "Abrir carrinho de orçamento" : `Abrir carrinho de orçamento (${totalItems} unidades)`}
      >
        <ShoppingCart className="w-6 h-6" />
        {!vazio && (
          <>
            <span className="text-sm">Meu pedido</span>
            <span className="min-w-[24px] h-6 px-1.5 rounded-full bg-white text-green-cta text-xs font-extrabold flex items-center justify-center">
              {totalItems}
            </span>
          </>
        )}
      </button>
      <QuotationDrawer />
    </>
  );
};

export default CartFab;
