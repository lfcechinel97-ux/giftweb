import { useState } from "react";
import WhatsAppModal from "./WhatsAppModal";

interface FloatingWhatsAppProps {
  useDirectMessage?: boolean;
}

const FloatingWhatsApp = ({ useDirectMessage = false }: FloatingWhatsAppProps) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-[90] w-14 h-14 rounded-full bg-green-cta flex items-center justify-center text-white transition-transform duration-200 hover:scale-110 active:scale-95"
        style={{
          boxShadow: "0 4px 24px rgba(34,197,94,0.5)",
          animation: "pulse-green 2s cubic-bezier(0.4,0,0.6,1) infinite",
        }}
        aria-label="Fale conosco pelo WhatsApp"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          width="28"
          height="28"
        >
          <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm.01 1.67c2.2 0 4.26.86 5.82 2.42a8.23 8.23 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23-1.48 0-2.93-.4-4.19-1.15l-.3-.17-3.12.82.83-3.04-.2-.3a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24zM8.53 7.33c-.16 0-.43.06-.65.3-.22.25-.84.83-.84 2.02 0 1.19.86 2.34.98 2.5.12.16 1.7 2.6 4.12 3.64.58.25 1.03.4 1.38.52.58.18 1.11.15 1.53.09.46-.07 1.43-.58 1.63-1.15.2-.56.2-1.04.14-1.14-.06-.1-.22-.17-.46-.28-.25-.12-1.44-.71-1.66-.79-.22-.08-.38-.12-.54.12-.16.25-.62.79-.76.95-.14.16-.28.18-.52.06-.25-.12-1.04-.38-1.97-1.22-.73-.65-1.22-1.44-1.36-1.69-.14-.24-.02-.37.1-.49.11-.11.25-.28.37-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.46-.4-.4-.54-.41h-.47z" />
        </svg>
      </button>
      <WhatsAppModal open={open} onClose={() => setOpen(false)} useDirectMessage={useDirectMessage} />
    </>
  );
};

export default FloatingWhatsApp;
