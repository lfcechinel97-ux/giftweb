import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Minus, Plus, Trash2, ShoppingBag, Send } from "lucide-react";
import { useQuotation } from "@/contexts/QuotationContext";
import { calcularPreco, formatarBRL } from "@/utils/price";
import { WHATSAPP_REDIRECT_URL } from "@/config/site";

const QuotationDrawer = () => {
  const { items, totalItems, removeItem, updateQty, clearAll, isOpen, setIsOpen } = useQuotation();

  const handleSendWhatsApp = () => {
    const lines = items.map((item, i) => {
      const price = item.price ? formatarBRL(calcularPreco(item.price, item.quantity)) : "sob consulta";
      return `${i + 1}. ${item.name} (Cód: ${item.codigo_amigavel}) — Qtd: ${item.quantity} — ${price}/un`;
    });
    const msg = `Olá! Gostaria de solicitar um orçamento:\n\n${lines.join("\n")}\n\nTotal de itens: ${totalItems}`;
    window.open(WHATSAPP_REDIRECT_URL, "_blank");
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent className="w-full sm:max-w-md flex flex-col bg-background">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-foreground">
            <ShoppingBag className="w-5 h-5 text-green-cta" />
            Orçamento ({totalItems} {totalItems === 1 ? "item" : "itens"})
          </SheetTitle>
          <SheetDescription>Revise os itens e envie via WhatsApp</SheetDescription>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
            <ShoppingBag className="w-12 h-12 opacity-30" />
            <p className="text-sm">Nenhum item adicionado</p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto space-y-3 py-4">
              {items.map(item => {
                const unitPrice = item.price ? calcularPreco(item.price, item.quantity) : null;
                return (
                  <div key={item.id} className="flex gap-3 p-3 rounded-xl bg-card border border-border">
                    <img src={item.image} alt={item.name} className="w-16 h-16 rounded-lg object-cover shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground line-clamp-2">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.codigo_amigavel}</p>
                      {unitPrice && (
                        <p className="text-xs text-green-cta font-semibold mt-0.5">{formatarBRL(unitPrice)}/un</p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <button onClick={() => updateQty(item.id, item.quantity - 1)} className="w-7 h-7 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-green-cta transition-colors">
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={e => updateQty(item.id, Math.max(1, parseInt(e.target.value) || 1))}
                          className="w-14 text-center text-sm font-semibold bg-transparent border border-border rounded-md py-1 text-foreground focus:outline-none focus:border-green-cta"
                        />
                        <button onClick={() => updateQty(item.id, item.quantity + 1)} className="w-7 h-7 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-green-cta transition-colors">
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => removeItem(item.id)} className="ml-auto w-7 h-7 rounded-md flex items-center justify-center text-destructive/70 hover:text-destructive hover:bg-destructive/10 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-border pt-4 space-y-3">
              <Button type="button" onClick={handleSendWhatsApp} className="w-full bg-green-cta hover:bg-green-cta/90 text-primary-foreground font-bold gap-2">
                <Send className="w-4 h-4" />
                Enviar orçamento via WhatsApp
              </Button>
              <Button variant="outline" size="sm" onClick={clearAll} className="w-full text-muted-foreground">
                Limpar tudo
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default QuotationDrawer;
