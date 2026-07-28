import { useEffect, useState } from "react";
import { ShoppingBag, Minus, Plus, X, MessageCircle, Trash2, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatarBRL } from "@/utils/price";
import { useTopCart } from "@/contexts/TopProdutosCart";
import { WHATSAPP_NUMBER } from "@/config/site";

const TopCartBar = () => {
  const { items, totalItems, setQty, removeItem, clearAll } = useTopCart();
  const [open, setOpen] = useState(false);
  const [obs, setObs] = useState("");

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("topprodutos:open-cart", handler);
    return () => window.removeEventListener("topprodutos:open-cart", handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const enviarWhatsApp = () => {
    const linhas = items.map((i, idx) => {
      const chunks = [
        `${idx + 1}. ${i.nome}`,
        i.sku ? `   SKU: ${i.sku}` : null,
        i.cor ? `   Cor: ${i.cor}` : null,
        `   Quantidade: ${i.quantidade} un`,
        i.preco != null ? `   Valor: ${formatarBRL(i.preco)}/un` : null,
      ].filter(Boolean);
      return chunks.join("\n");
    });
    const partes = [
      "Olá! Gostaria de solicitar um orçamento dos seguintes produtos:",
      "",
      ...linhas,
    ];
    if (obs.trim()) {
      partes.push("", `Observações: ${obs.trim()}`);
    }
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(partes.join("\n"))}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      {/* Botão flutuante — só o ícone, grande e clean */}
      {totalItems > 0 && !open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={`Ver carrinho com ${totalItems} ${totalItems === 1 ? "item" : "itens"}`}
          className={cn(
            "fixed z-[92] right-5 sm:right-8 bottom-24 sm:bottom-28",
            "relative flex items-center justify-center w-16 h-16 sm:w-[68px] sm:h-[68px] rounded-full",
            "bg-green-cta text-white hover:brightness-110 active:scale-95 transition-all animate-fade-in"
          )}
          style={{ boxShadow: "0 16px 40px -10px rgba(34,197,94,0.75)" }}
        >
          <ShoppingCart className="w-7 h-7 sm:w-8 sm:h-8" strokeWidth={2} />
          <span className="absolute -top-1 -right-1 min-w-[24px] h-[24px] px-1 rounded-full bg-white text-navy text-xs font-black flex items-center justify-center ring-2 ring-white">
            {totalItems}
          </span>
        </button>
      )}

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-[95] bg-navy/50 backdrop-blur-sm animate-fade-in"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Drawer lateral direito */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Seu orçamento"
        className={cn(
          "fixed top-0 right-0 z-[96] h-full w-full sm:w-[440px] md:w-[480px] bg-white shadow-2xl",
          "flex flex-col transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full pointer-events-none"
        )}
      >
        {/* Header do drawer */}
        <header className="shrink-0 px-6 sm:px-7 pt-7 pb-5 border-b border-slate-100">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-green-cta">
                <span className="w-1.5 h-1.5 rounded-full bg-green-cta" />
                Seu orçamento
              </span>
              <h2
                className="mt-2 text-2xl sm:text-3xl font-light text-navy tracking-tight leading-tight"
                style={{ fontFamily: "'Georgia', serif" }}
              >
                {totalItems === 0
                  ? "Carrinho vazio"
                  : `${totalItems} ${totalItems === 1 ? "item" : "itens"} selecionados`}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar carrinho"
              className="shrink-0 w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-navy flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {items.length > 0 && (
            <button
              onClick={clearAll}
              className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-red-500 uppercase tracking-widest font-semibold transition-colors"
            >
              <Trash2 className="w-3 h-3" /> Limpar tudo
            </button>
          )}
        </header>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto px-6 sm:px-7 py-5">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 py-16">
              <ShoppingBag className="w-10 h-10 mb-3 text-slate-300" />
              <p className="text-sm font-light">
                Escolha produtos para montar seu orçamento.
              </p>
            </div>
          ) : (
            <ul className="space-y-5">
              {items.map((i) => (
                <li key={i.id} className="flex gap-4 pb-5 border-b border-slate-100 last:border-b-0 last:pb-0">
                  <div className="w-20 h-24 sm:w-24 sm:h-28 shrink-0 bg-slate-50 rounded-xl overflow-hidden flex items-center justify-center">
                    {i.image ? (
                      <img
                        src={i.image}
                        alt={i.nome}
                        className="w-full h-full object-contain p-2"
                        loading="lazy"
                      />
                    ) : (
                      <ShoppingBag className="w-6 h-6 text-slate-300" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3
                          className="text-[15px] font-normal text-navy leading-snug tracking-tight line-clamp-2"
                          style={{ fontFamily: "'Georgia', serif" }}
                        >
                          {i.nome}
                        </h3>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500 font-light">
                          {i.sku && (
                            <span>
                              SKU <span className="text-navy font-medium tabular-nums">{i.sku}</span>
                            </span>
                          )}
                          {i.cor && (
                            <span>
                              Cor <span className="text-navy font-medium">{i.cor}</span>
                            </span>
                          )}
                        </div>
                        {i.preco != null && (
                          <p className="mt-1.5 text-sm text-navy font-medium tabular-nums">
                            {formatarBRL(i.preco)}
                            <span className="text-slate-400 font-light"> / un</span>
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => removeItem(i.id)}
                        aria-label="Remover"
                        className="shrink-0 w-7 h-7 flex items-center justify-center text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="mt-3 inline-flex items-center gap-1 border border-slate-200 rounded-full h-9 px-1">
                      <button
                        onClick={() => setQty(i.id, Math.max(1, i.quantidade - 5))}
                        aria-label="Diminuir"
                        className="w-7 h-7 flex items-center justify-center text-navy/70 hover:text-navy"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-sm font-medium text-navy tabular-nums min-w-[3ch] text-center">
                        {i.quantidade}
                      </span>
                      <button
                        onClick={() => setQty(i.id, i.quantidade + 5)}
                        aria-label="Aumentar"
                        className="w-7 h-7 flex items-center justify-center text-green-cta hover:brightness-110"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}

              <li>
                <label
                  className="block text-[10px] font-semibold text-navy uppercase tracking-[0.22em] mb-2"
                >
                  Observações
                </label>
                <textarea
                  value={obs}
                  onChange={(e) => setObs(e.target.value)}
                  placeholder="Ex.: preciso em 15 dias, com logo em 1 cor"
                  rows={3}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-navy placeholder:text-slate-400 focus:outline-none focus:border-navy resize-none font-light"
                />
              </li>
            </ul>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <footer className="shrink-0 px-6 sm:px-7 py-5 border-t border-slate-100 bg-white">
            <button
              onClick={enviarWhatsApp}
              className="w-full h-14 rounded-full bg-green-cta text-white font-semibold text-sm tracking-wide hover:brightness-110 active:scale-[0.99] transition inline-flex items-center justify-center gap-2.5 shadow-[0_10px_28px_-8px_rgba(34,197,94,0.6)]"
            >
              <MessageCircle className="w-5 h-5" strokeWidth={2} />
              Enviar para o WhatsApp
            </button>
            <p className="mt-3 text-center text-[11px] text-slate-400 font-light">
              Nosso time responde com o orçamento final em minutos.
            </p>
          </footer>
        )}
      </aside>
    </>
  );
};

export default TopCartBar;
