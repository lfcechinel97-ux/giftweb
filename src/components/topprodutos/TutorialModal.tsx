import { useEffect, useState } from "react";
import { X, LayoutGrid, Package, ShoppingCart, MessageCircle, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "topprodutos_tutorial_seen_v1";

type Step = {
  icon: typeof LayoutGrid;
  title: string;
  subtitle: string;
};

const steps: Step[] = [
  {
    icon: LayoutGrid,
    title: "Escolha uma categoria",
    subtitle: "Navegue pelas linhas de brindes e encontre o segmento ideal para sua ação.",
  },
  {
    icon: Package,
    title: "Selecione o produto",
    subtitle: "Escolha a quantidade necessária e clique em “Adicionar ao orçamento”.",
  },
  {
    icon: ShoppingCart,
    title: "Abra seu carrinho",
    subtitle: "Toque no botão verde de carrinho no canto direito da tela para revisar seus itens.",
  },
  {
    icon: MessageCircle,
    title: "Envie pelo WhatsApp",
    subtitle: "Clique em “Enviar para o WhatsApp” e nosso time responde com o orçamento final.",
  },
];

export const TutorialModal = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
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
        className="absolute inset-0 bg-navy/70 backdrop-blur-sm"
        onClick={close}
        aria-hidden="true"
      />

      <div
        className={cn(
          "relative w-full max-w-lg bg-white shadow-2xl overflow-hidden",
          "rounded-t-3xl sm:rounded-3xl",
          "animate-slide-in-right sm:animate-scale-in"
        )}
        style={{ animationDuration: "300ms" }}
      >
        {/* Faixa superior navy com identidade */}
        <div className="relative bg-navy text-white px-6 sm:px-8 pt-7 pb-6">
          <button
            type="button"
            onClick={close}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            aria-label="Fechar tutorial"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 mb-3">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-cta" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.3em] text-green-cta">
              Guia rápido
            </span>
          </div>

          <h2
            id="tutorial-title"
            className="text-2xl sm:text-3xl font-light tracking-tight leading-tight"
            style={{ fontFamily: "'Georgia', serif" }}
          >
            Como montar seu <span className="italic text-green-cta">orçamento</span>
          </h2>
          <p className="mt-2 text-sm text-white/70 leading-relaxed font-light">
            Quatro passos simples para receber sua cotação em minutos, direto pelo WhatsApp.
          </p>
        </div>

        {/* Passos */}
        <div className="px-6 sm:px-8 py-6 sm:py-7">
          <ol className="space-y-5">
            {steps.map((s, i) => {
              const Icon = s.icon;
              const isLast = i === steps.length - 1;
              return (
                <li key={s.title} className="flex gap-4">
                  <div className="flex flex-col items-center shrink-0">
                    <div
                      className={cn(
                        "w-11 h-11 rounded-full flex items-center justify-center relative",
                        isLast
                          ? "bg-green-cta text-white shadow-[0_6px_16px_-4px_rgba(34,197,94,0.6)]"
                          : "bg-slate-100 text-navy"
                      )}
                    >
                      <Icon className="w-5 h-5" strokeWidth={2} />
                      <span className="absolute -top-1 -left-1 min-w-[18px] h-[18px] px-1 rounded-full bg-white ring-2 ring-slate-100 text-navy text-[10px] font-bold flex items-center justify-center">
                        {i + 1}
                      </span>
                    </div>
                    {!isLast && (
                      <span className="w-px flex-1 bg-slate-200 mt-2" aria-hidden="true" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 pb-1">
                    <p className="text-sm sm:text-base font-semibold text-navy leading-snug">
                      {s.title}
                    </p>
                    <p className="mt-1 text-xs sm:text-sm text-slate-500 leading-relaxed font-light">
                      {s.subtitle}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>

          <button
            type="button"
            onClick={close}
            className="mt-7 w-full h-12 rounded-full bg-green-cta text-white font-semibold text-sm tracking-wide hover:brightness-110 active:scale-[0.98] transition shadow-[0_10px_28px_-8px_rgba(34,197,94,0.65)]"
          >
            Começar agora
          </button>

          <p className="mt-3 text-center text-[11px] text-slate-400 font-light">
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
      className="fixed z-40 bottom-24 left-4 sm:bottom-28 sm:left-6 w-11 h-11 rounded-full bg-white border border-slate-200 shadow-lg text-navy hover:text-green-cta hover:border-green-cta transition-colors flex items-center justify-center"
    >
      <HelpCircle className="w-5 h-5" strokeWidth={2} />
    </button>
  );
};
