import { useEffect, useState } from "react";
import { X, LayoutGrid, Package, ShoppingCart, MessageCircle, HelpCircle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "topprodutos_tutorial_seen_v1";

const steps = [
  { icon: LayoutGrid, label: "Escolha uma categoria" },
  { icon: Package, label: "Selecione o produto" },
  { icon: ShoppingCart, label: "Adicione ao carrinho" },
  { icon: MessageCircle, label: "Envie pelo WhatsApp" },
];

const GOLD = "#D4A15A";
const CORAL = "#E87A5D";

export const TutorialModal = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        // slight delay so it doesn't fight the first paint
        const t = setTimeout(() => setOpen(true), 500);
        return () => clearTimeout(t);
      }
    } catch {
      /* localStorage bloqueado — ignore */
    }
  }, []);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("topprodutos:open-tutorial", handler);
    return () => window.removeEventListener("topprodutos:open-tutorial", handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* noop */
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-title"
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-6 animate-fade-in"
    >
      <div
        className="absolute inset-0 bg-navy/60 backdrop-blur-sm"
        onClick={close}
        aria-hidden="true"
      />

      <div
        className={cn(
          "relative w-full max-w-md bg-white shadow-2xl",
          "rounded-t-3xl sm:rounded-3xl",
          "animate-slide-in-right sm:animate-scale-in"
        )}
        style={{ animationDuration: "300ms" }}
      >
        <button
          type="button"
          onClick={close}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-navy transition-colors"
          aria-label="Fechar tutorial"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-6 sm:p-8 pt-8">
          <div className="flex items-center gap-2 mb-2">
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ background: GOLD }}
            />
            <span
              className="text-[10px] font-bold uppercase tracking-[0.25em]"
              style={{ color: GOLD }}
            >
              Guia rápido
            </span>
          </div>

          <h2 id="tutorial-title" className="text-2xl sm:text-3xl font-black text-navy tracking-tight leading-tight">
            Como fazer seu orçamento
          </h2>
          <p className="mt-2 text-sm text-slate-500 leading-relaxed">
            Em poucos toques você monta o pedido e envia direto pelo WhatsApp.
          </p>

          {/* Passos com ícones */}
          <div className="mt-6 space-y-3">
            {steps.map((s, i) => {
              const Icon = s.icon;
              const isLast = i === steps.length - 1;
              return (
                <div key={s.label} className="flex items-center gap-3">
                  <div
                    className="shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center"
                    style={{
                      background: isLast ? "hsl(var(--green-cta) / 0.12)" : "rgba(15,23,42,0.05)",
                      color: isLast ? "hsl(var(--green-cta))" : "hsl(var(--navy))",
                    }}
                  >
                    <Icon className="w-5 h-5" strokeWidth={2} />
                  </div>
                  <div className="flex-1 flex items-center justify-between gap-2 min-w-0">
                    <span className="text-sm font-semibold text-navy truncate">
                      {s.label}
                    </span>
                    {!isLast && (
                      <ArrowRight className="w-4 h-4 shrink-0" style={{ color: CORAL }} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={close}
            className="mt-7 w-full h-12 rounded-2xl bg-navy text-white font-bold text-sm tracking-wide hover:bg-navy/90 active:scale-[0.98] transition"
          >
            Começar
          </button>

          <p className="mt-3 text-center text-[11px] text-slate-400">
            Você pode reabrir este guia pelo ícone “?” no canto da tela.
          </p>
        </div>
      </div>
    </div>
  );
};

export const TutorialHelpButton = () => {
  const open = () => window.dispatchEvent(new Event("topprodutos:open-tutorial"));
  return (
    <button
      type="button"
      onClick={open}
      aria-label="Como funciona"
      className="fixed z-40 bottom-24 right-4 sm:bottom-28 sm:right-6 w-11 h-11 rounded-full bg-white border border-slate-200 shadow-lg text-navy hover:text-green-cta hover:border-green-cta transition-colors flex items-center justify-center"
    >
      <HelpCircle className="w-5 h-5" strokeWidth={2} />
    </button>
  );
};
