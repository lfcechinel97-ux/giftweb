import { useState } from "react";
import WhatsAppModal from "./WhatsAppModal";

const FloatingWhatsApp = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-[90] w-14 h-14 rounded-full bg-green-cta flex items-center justify-center text-primary-foreground transition-transform duration-200 hover:scale-110"
        style={{
          boxShadow: "0 4px 20px rgba(34,197,94,0.4)",
          animation: "pulse-green 2s cubic-bezier(0.4,0,0.6,1) infinite",
        }}
        aria-label="Fale conosco pelo WhatsApp"
      >
        <img src="/logos/whatsapp-white.svg" alt="WhatsApp" className="w-7 h-7" />
      </button>
      <WhatsAppModal open={open} onClose={() => setOpen(false)} />
    </>
  );
};

export default FloatingWhatsApp;
