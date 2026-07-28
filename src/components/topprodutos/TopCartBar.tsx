import { useEffect, useState } from "react";
import { ShoppingBag, ChevronUp, ChevronDown, Minus, Plus, X, MessageCircle, Trash2, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatarBRL } from "@/utils/price";
import { useTopCart } from "@/contexts/TopProdutosCart";
import { WHATSAPP_NUMBER } from "@/config/site";

const TopCartBar = () => {
  const { items, totalItems, setQty, removeItem, clearAll } = useTopCart();
  const [expanded, setExpanded] = useState(false);
  const [obs, setObs] = useState("");

  useEffect(() => {
    const handler = () => setExpanded(true);
    window.addEventListener("topprodutos:open-cart", handler);
    return () => window.removeEventListener("topprodutos:open-cart", handler);
  }, []);

  if (totalItems === 0) return null;

  const total = items.reduce((s, i) => s + (i.preco ?? 0) * i.quantidade, 0);


  const enviarWhatsApp = () => {
    const linhas = items.map(
      (i, idx) =>
        `${idx + 1}. ${i.nome}\n   Qtd: ${i.quantidade}${i.preco ? ` — ${formatarBRL(i.preco)}/un` : ""}`
    );
    const partes = [
      "Olá! Gostaria de solicitar um orçamento dos seguintes produtos:",
      "",
      ...linhas,
    ];
    if (obs.trim()) {
      partes.push("", `Observações: ${obs.trim()}`);
    }
    partes.push("", `Total de itens: ${totalItems}`);
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(partes.join("\n"))}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      {expanded && (
        <div
          className="fixed inset-0 z-[90] bg-black/40 backdrop-blur-sm animate-fade-in"
          onClick={() => setExpanded(false)}
        />
      )}

      <div
        className={cn(
          "fixed left-0 right-0 bottom-0 z-[95] bg-white border-t border-slate-200 shadow-[0_-4px_24px_rgba(0,0,0,0.08)]",
          "transition-all duration-300"
        )}
      >
        {/* Painel expandido */}
        {expanded && (
          <div className="max-h-[70vh] overflow-y-auto border-b border-slate-100 animate-slide-up">
            <div className="container mx-auto px-4 sm:px-6 lg:px-12 py-6 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-lg md:text-xl font-bold text-navy">
                  Seu pedido ({totalItems} {totalItems === 1 ? "item" : "itens"})
                </h3>
                <button
                  onClick={clearAll}
                  className="text-xs text-slate-400 hover:text-red-500 uppercase tracking-widest font-bold inline-flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Limpar
                </button>
              </div>

              <ul className="divide-y divide-slate-100">
                {items.map((i) => (
                  <li key={i.id} className="py-4 flex items-center gap-4">
                    <div className="w-16 h-16 shrink-0 bg-slate-50 rounded-lg overflow-hidden flex items-center justify-center">
                      {i.image ? (
                        <img src={i.image} alt={i.nome} className="w-full h-full object-contain p-1" />
                      ) : (
                        <ShoppingBag className="w-6 h-6 text-slate-300" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-navy truncate">{i.nome}</p>
                      {i.categoria && (
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-0.5">
                          {i.categoria}
                        </p>
                      )}
                      <p className="text-xs text-slate-500 mt-1">
                        {i.preco ? `${formatarBRL(i.preco)} / un` : "Preço sob consulta"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 border border-slate-200 rounded-full px-1 h-9">
                      <button
                        onClick={() => setQty(i.id, i.quantidade - 1)}
                        aria-label="Diminuir"
                        className="w-7 h-7 flex items-center justify-center text-navy"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-sm font-bold text-navy tabular-nums min-w-[2ch] text-center">
                        {i.quantidade}
                      </span>
                      <button
                        onClick={() => setQty(i.id, i.quantidade + 1)}
                        aria-label="Aumentar"
                        className="w-7 h-7 flex items-center justify-center text-green-cta"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <button
                      onClick={() => removeItem(i.id)}
                      aria-label="Remover"
                      className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>

              <div>
                <label className="block text-xs font-bold text-navy uppercase tracking-widest mb-2">
                  Observação (cor, prazo, personalização…)
                </label>
                <textarea
                  value={obs}
                  onChange={(e) => setObs(e.target.value)}
                  placeholder="Ex.: preciso em 15 dias, com logo em 1 cor"
                  rows={2}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-navy placeholder:text-slate-400 focus:outline-none focus:border-navy resize-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Barra base */}
        <div className="container mx-auto px-4 sm:px-6 lg:px-12">
          <div className="flex items-center justify-between gap-3 h-16 md:h-20">
            <button
              onClick={() => setExpanded((e) => !e)}
              className="flex items-center gap-3 text-left flex-1 min-w-0"
            >
              <div className="relative w-11 h-11 rounded-full bg-navy flex items-center justify-center shrink-0">
                <ShoppingBag className="w-5 h-5 text-white" />
                <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-green-cta text-white text-[10px] font-bold flex items-center justify-center">
                  {totalItems}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-sm md:text-base font-bold text-navy leading-tight">
                  {totalItems} {totalItems === 1 ? "item selecionado" : "itens selecionados"}
                </p>
                {total > 0 && (
                  <p className="text-xs text-slate-500 hidden sm:block">
                    Estimativa: {formatarBRL(total)}
                  </p>
                )}
              </div>
              {expanded ? (
                <ChevronDown className="w-4 h-4 text-slate-400 hidden sm:block ml-2" />
              ) : (
                <ChevronUp className="w-4 h-4 text-slate-400 hidden sm:block ml-2" />
              )}
            </button>

            <button
              onClick={enviarWhatsApp}
              className="inline-flex items-center gap-2 h-11 md:h-12 px-5 md:px-7 rounded-full bg-green-cta text-white text-xs md:text-sm font-bold uppercase tracking-widest hover:brightness-110 transition shrink-0"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Pedir orçamento</span>
              <span className="sm:hidden">Orçamento</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default TopCartBar;
