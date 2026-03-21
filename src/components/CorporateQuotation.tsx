import { useState } from "react";
import { useInView } from "@/hooks/useInView";
import WhatsAppModal from "./WhatsAppModal";

const CorporateQuotation = () => {
  const { ref, inView } = useInView();
  const [open, setOpen] = useState(false);

  return (
    <>
      <section className="relative overflow-hidden bg-navy">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 50% 50%, hsla(82,84%,55%,0.06) 0%, transparent 60%)",
          }}
        />
        <div
          className="absolute top-0 left-0 right-0 h-px pointer-events-none"
          style={{
            background:
              "linear-gradient(90deg, transparent, hsla(82,84%,55%,0.25), transparent)",
          }}
        />

        <div className="px-0 md:px-4 py-10 md:py-12 flex justify-center">
          <div
            ref={ref}
            className={`relative z-10 w-full max-w-4xl md:rounded-3xl md:border md:border-white/10 md:bg-white/5 md:backdrop-blur-sm transition-all duration-700 ${
              inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
            }`}
          >
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8 px-6 py-2 md:p-10">
              <div className="flex flex-col items-center text-center md:items-start md:text-left flex-1">
                <span className="text-green-cta text-xs font-semibold uppercase tracking-[0.15em] mb-4">
                  Atendimento corporativo especializado
                </span>

                <h2 className="text-white font-extrabold text-[26px] md:text-[34px] leading-tight mb-4">
                  Solicite uma cotação<br className="hidden md:block" /> para sua empresa
                </h2>

                <p className="text-white/60 text-sm md:text-base leading-relaxed max-w-sm">
                  Brindes personalizados com suporte comercial, produção sob demanda
                  e atendimento para todo o Brasil
                </p>
              </div>

              <div className="flex flex-col items-center gap-4 shrink-0">
                <button
                  onClick={() => setOpen(true)}
                  className="group inline-flex items-center justify-center gap-3 rounded-2xl bg-green-cta px-8 md:px-10 py-4 md:py-5 font-bold text-navy text-sm md:text-base uppercase tracking-wide transition-all duration-300 hover:brightness-110 hover:scale-[1.02] w-full md:w-auto"
                  style={{ animation: "pulse-whatsapp 3.5s ease-out infinite" }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-[22px] h-[22px] flex-shrink-0 transition-transform duration-300 group-hover:scale-110"
                  >
                    <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm.01 1.67c2.2 0 4.26.86 5.82 2.42a8.23 8.23 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23-1.48 0-2.93-.4-4.19-1.15l-.3-.17-3.12.82.83-3.04-.2-.3a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24zM8.53 7.33c-.16 0-.43.06-.65.3-.22.25-.84.83-.84 2.02 0 1.19.86 2.34.98 2.5.12.16 1.7 2.6 4.12 3.64.58.25 1.03.4 1.38.52.58.18 1.11.15 1.53.09.46-.07 1.43-.58 1.63-1.15.2-.56.2-1.04.14-1.14-.06-.1-.22-.17-.46-.28-.25-.12-1.44-.71-1.66-.79-.22-.08-.38-.12-.54.12-.16.25-.62.79-.76.95-.14.16-.28.18-.52.06-.25-.12-1.04-.38-1.97-1.22-.73-.65-1.22-1.44-1.36-1.69-.14-.24-.02-.37.1-.49.11-.11.25-.28.37-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.46-.4-.4-.54-.41h-.47z" />
                  </svg>
                  Solicitar Cotação Corporativa
                </button>

                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-cta animate-[blink_2s_ease-in-out_infinite]" />
                  <span className="text-white/50 text-xs font-medium">Online agora</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <WhatsAppModal open={open} onClose={() => setOpen(false)} />
    </>
  );
};

export default CorporateQuotation;
