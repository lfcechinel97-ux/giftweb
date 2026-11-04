import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Minus, Plus, Trash2, ShoppingBag, Send } from "lucide-react";
import { useQuotation, unitarioDoItem, type QuotationItem } from "@/contexts/QuotationContext";
import { formatarBRL } from "@/utils/price";
import { WHATSAPP_NUMBER, WHATSAPP_REDIRECT_URL } from "@/config/site";

/** Pedido mínimo do site e passo do +/- (o mesmo da página do produto). */
const QTD_MINIMA = 20;
const PASSO = 10;

/**
 * Teto do texto do wa.me já codificado: acima disso alguns aparelhos cortam o
 * fim da mensagem, justo onde fica o total (mesma regra do /catalogo-clientes).
 */
const MAX_TEXTO_WA = 1800;

/** "R$" vem separado por espaço não-quebrável, que vira lixo em alguns WhatsApp. */
const moeda = (v: number) => formatarBRL(v).replace(/\u00a0/g, " ");

const subtotalDoItem = (i: QuotationItem) => {
  const u = unitarioDoItem(i);
  return u === null ? null : u * i.quantity;
};

function montarLinkWhatsApp(items: QuotationItem[]): string {
  const totalUn = items.reduce((s, i) => s + i.quantity, 0);
  const totalValor = items.reduce((s, i) => s + (subtotalDoItem(i) ?? 0), 0);
  const semPreco = items.filter((i) => subtotalDoItem(i) === null).length;

  const linha = (i: QuotationItem, curta: boolean) => {
    const u = unitarioDoItem(i);
    const cabeca = `- ${i.name} (cód ${i.codigo_amigavel}): ${i.quantity} un`;
    if (u === null) return `${cabeca} - valor sob consulta`;
    const sub = u * i.quantity;
    return curta ? `${cabeca} - ${moeda(sub)}` : `${cabeca} x ${moeda(u)} = ${moeda(sub)}`;
  };

  const resumo =
    totalValor > 0
      ? `Total: ${totalUn} un - ${moeda(totalValor)}` +
        (semPreco ? ` (+ ${semPreco} ${semPreco === 1 ? "item" : "itens"} sob consulta)` : "")
      : `Total: ${totalUn} un`;

  const montar = (linhas: string[], escondidos: number) => {
    const lista = escondidos
      ? [...linhas, `- ... e mais ${escondidos} ${escondidos === 1 ? "item" : "itens"}`]
      : linhas;
    return (
      `Olá! Vim pelo site e gostaria de um orçamento destes brindes:\n\n${lista.join("\n")}\n\n${resumo}\n` +
      `Valores do site por faixa de quantidade, a confirmar com o consultor.`
    );
  };
  const cabe = (t: string) => encodeURIComponent(t).length <= MAX_TEXTO_WA;
  const link = (t: string) => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(t)}`;

  // 1) tudo detalhado; 2) forma curta; 3) forma curta cortando itens do fim —
  // o total nunca se perde.
  const detalhado = montar(items.map((i) => linha(i, false)), 0);
  if (cabe(detalhado)) return link(detalhado);
  const curtas = items.map((i) => linha(i, true));
  let n = curtas.length;
  let texto = montar(curtas, 0);
  while (n > 1 && !cabe(texto)) {
    n -= 1;
    texto = montar(curtas.slice(0, n), curtas.length - n);
  }
  return link(texto);
}

const QuotationDrawer = () => {
  const { items, totalItems, removeItem, updateQty, clearAll, isOpen, setIsOpen } = useQuotation();

  const totalValor = items.reduce((s, i) => s + (subtotalDoItem(i) ?? 0), 0);
  const semPreco = items.filter((i) => subtotalDoItem(i) === null).length;

  const handleSendWhatsApp = () => {
    window.open(montarLinkWhatsApp(items), "_blank", "noopener,noreferrer");
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      {/* z acima do menu flutuante do Header (z-60/110) e do botão do carrinho (z-90) */}
      <SheetContent className="z-[120] w-full sm:max-w-md flex flex-col bg-background" overlayClassName="z-[120]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-foreground">
            <ShoppingBag className="w-5 h-5 text-green-cta" />
            Carrinho de orçamento
          </SheetTitle>
          <SheetDescription>Revise os itens e envie seu pedido pelo WhatsApp</SheetDescription>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3 text-center px-4">
            <ShoppingBag className="w-12 h-12 opacity-30" />
            <p className="text-sm">Seu carrinho está vazio.<br />Escolha os produtos e a quantidade e adicione aqui.</p>
            <a
              href={WHATSAPP_REDIRECT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 text-sm font-semibold text-green-cta hover:underline"
            >
              Prefere falar direto com um consultor?
            </a>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto space-y-3 py-4">
              {items.map((item) => {
                const unitPrice = unitarioDoItem(item);
                return (
                  <div key={item.id} className="flex gap-3 p-3 rounded-xl bg-card border border-border">
                    <img src={item.image} alt={item.name} className="w-16 h-16 rounded-lg object-cover shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground line-clamp-2">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.codigo_amigavel}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          type="button"
                          aria-label="Diminuir quantidade"
                          onClick={() => updateQty(item.id, Math.max(QTD_MINIMA, item.quantity - PASSO))}
                          className="w-7 h-7 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-green-cta transition-colors"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <input
                          type="number"
                          min={QTD_MINIMA}
                          value={item.quantity}
                          onChange={(e) => updateQty(item.id, Math.max(1, parseInt(e.target.value) || 1))}
                          onBlur={(e) => updateQty(item.id, Math.max(QTD_MINIMA, parseInt(e.target.value) || QTD_MINIMA))}
                          className="w-16 text-center text-sm font-semibold bg-transparent border border-border rounded-md py-1 text-foreground focus:outline-none focus:border-green-cta"
                        />
                        <button
                          type="button"
                          aria-label="Aumentar quantidade"
                          onClick={() => updateQty(item.id, item.quantity + PASSO)}
                          className="w-7 h-7 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-green-cta transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label="Remover item"
                          onClick={() => removeItem(item.id)}
                          className="ml-auto w-7 h-7 rounded-md flex items-center justify-center text-destructive/70 hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex items-baseline justify-between mt-2 text-xs">
                        {unitPrice !== null ? (
                          <>
                            <span className="text-muted-foreground">{formatarBRL(unitPrice)} /un</span>
                            <span className="text-foreground font-bold text-sm">{formatarBRL(unitPrice * item.quantity)}</span>
                          </>
                        ) : (
                          <span className="text-muted-foreground">valor sob consulta</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-border pt-4 space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">
                  {totalItems} {totalItems === 1 ? "unidade" : "unidades"}
                </span>
                <span className="text-lg font-extrabold text-foreground">
                  {totalValor > 0 ? formatarBRL(totalValor) : "sob consulta"}
                </span>
              </div>
              {semPreco > 0 && totalValor > 0 && (
                <p className="text-xs text-muted-foreground text-right -mt-2">
                  + {semPreco} {semPreco === 1 ? "item" : "itens"} sob consulta
                </p>
              )}
              <Button type="button" onClick={handleSendWhatsApp} className="w-full bg-green-cta hover:bg-green-cta/90 text-primary-foreground font-bold gap-2">
                <Send className="w-4 h-4" />
                Finalizar no WhatsApp
              </Button>
              <p className="text-[11px] text-muted-foreground text-center leading-snug">
                Valores do site por faixa de quantidade.<br />Frete e prazo confirmados com o consultor.
              </p>
              <button
                type="button"
                onClick={clearAll}
                className="w-full text-xs text-muted-foreground hover:text-destructive transition-colors py-1"
              >
                Limpar carrinho
              </button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default QuotationDrawer;
