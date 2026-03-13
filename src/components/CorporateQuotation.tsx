import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { useInView } from "@/hooks/useInView";
import WhatsAppModal from "./WhatsAppModal";

const CorporateQuotation = () => {
  const { ref, inView } = useInView();
  const [open, setOpen] = useState(false);

  return (
    <>
      <section className="py-14 md:py-16 relative overflow-hidden" style={{ background: "hsl(222,47%,7%)" }}>
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse at center, rgba(34,197,94,0.08) 0%, transparent 70%)",
          }}
        />
        <div
          ref={ref}
          className={`container relative z-10 flex flex-col items-center text-center transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`}
        >
          <button
            onClick={() => setOpen(true)}
            className="group flex items-center justify-center gap-3 rounded-2xl bg-green-cta px-10 py-5 font-bold text-primary-foreground text-lg uppercase tracking-wide transition-all duration-300 hover:brightness-110 hover:scale-[1.03]"
            style={{ boxShadow: "0 0 40px rgba(34,197,94,0.25)" }}
          >
            <MessageCircle size={22} className="transition-transform duration-300 group-hover:rotate-12" />
            Solicitar Cotação Corporativa
          </button>

          <p className="mt-4 text-white/70 text-sm">
            Atendimento rápido para empresas, eventos e ações de marketing.
          </p>
        </div>
      </section>
      <WhatsAppModal open={open} onClose={() => setOpen(false)} />
    </>
  );
};

export default CorporateQuotation;
