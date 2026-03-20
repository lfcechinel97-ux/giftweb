import { useState } from "react";
import { X } from "lucide-react";

const WppIcon = ({ size = 20 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width={size} height={size}>
    <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm.01 1.67c2.2 0 4.26.86 5.82 2.42a8.23 8.23 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23-1.48 0-2.93-.4-4.19-1.15l-.3-.17-3.12.82.83-3.04-.2-.3a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24zM8.53 7.33c-.16 0-.43.06-.65.3-.22.25-.84.83-.84 2.02 0 1.19.86 2.34.98 2.5.12.16 1.7 2.6 4.12 3.64.58.25 1.03.4 1.38.52.58.18 1.11.15 1.53.09.46-.07 1.43-.58 1.63-1.15.2-.56.2-1.04.14-1.14-.06-.1-.22-.17-.46-.28-.25-.12-1.44-.71-1.66-.79-.22-.08-.38-.12-.54.12-.16.25-.62.79-.76.95-.14.16-.28.18-.52.06-.25-.12-1.04-.38-1.97-1.22-.73-.65-1.22-1.44-1.36-1.69-.14-.24-.02-.37.1-.49.11-.11.25-.28.37-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.3-.74-1.78-.2-.46-.4-.4-.54-.41h-.47z"/>
  </svg>
);

interface WhatsAppModalProps {
  open: boolean;
  onClose: () => void;
}

const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

const formatCurrency = (value: string) => {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  const num = parseInt(digits, 10) / 100;
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const WhatsAppModal = ({ open, onClose }: WhatsAppModalProps) => {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    company: "",
    quantity: "",
    budget: "",
    details: "",
  });
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  const update = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (value.trim()) setErrors((prev) => ({ ...prev, [field]: false }));
  };

  const validate = () => {
    const phoneDigits = form.phone.replace(/\D/g, "");
    const newErrors: Record<string, boolean> = {
      name: !form.name.trim(),
      phone: phoneDigits.length < 10 || phoneDigits.length > 11,
      quantity: !form.quantity.trim() || isNaN(Number(form.quantity)),
    };
    setErrors(newErrors);
    return !Object.values(newErrors).some(Boolean);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const lines = [
      "Olá! Gostaria de solicitar um orçamento.",
      "",
      `Nome: ${form.name}`,
      `Telefone: ${form.phone}`,
    ];
    if (form.company.trim()) lines.push(`Empresa: ${form.company}`);
    lines.push(`Quantidade aproximada: ${form.quantity}`);
    if (form.budget.trim()) lines.push(`Orçamento estimado: ${form.budget}`);
    if (form.details.trim()) lines.push(`Detalhes do pedido: ${form.details}`);

    window.open(
      `https://wa.me/5548996652844?text=${encodeURIComponent(lines.join("\n"))}`,
      "_blank"
    );
    onClose();
  };

  if (!open) return null;

  const inputClass = (field: string) =>
    `rounded-xl border ${errors[field] ? "border-destructive ring-2 ring-destructive/30" : "border-border"} bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-green-cta/40 focus:border-green-cta`;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-md rounded-2xl bg-card border border-border p-6 animate-scale-in overflow-y-auto max-h-[90vh]"
        style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-green-cta flex items-center justify-center text-white">
            <WppIcon size={20} />
          </div>
          <h3 className="text-foreground font-bold text-lg">Peça um orçamento rápido!</h3>
        </div>

        <p className="text-muted-foreground text-sm mb-5 leading-relaxed">
          Preencha os dados abaixo e nossa equipe entrará em contato para ajudar com seu orçamento.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {/* Nome */}
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">
              Nome <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              placeholder="Seu nome completo"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              className={inputClass("name")}
              style={{ width: "100%" }}
            />
          </div>

          {/* Telefone */}
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">
              Telefone / WhatsApp <span className="text-destructive">*</span>
            </label>
            <input
              type="tel"
              placeholder="(11) 91234-5678"
              value={form.phone}
              onChange={(e) => update("phone", formatPhone(e.target.value))}
              className={inputClass("phone")}
              style={{ width: "100%" }}
            />
          </div>

          {/* Empresa */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Empresa</label>
            <input
              type="text"
              placeholder="Nome da empresa (opcional)"
              value={form.company}
              onChange={(e) => update("company", e.target.value)}
              className={inputClass("company")}
              style={{ width: "100%" }}
            />
          </div>

          {/* Quantidade */}
          <div>
            <label className="text-xs font-semibold text-foreground mb-1 block">
              Quantidade aproximada <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="Ex: 500"
              value={form.quantity}
              onChange={(e) => update("quantity", e.target.value.replace(/\D/g, ""))}
              className={inputClass("quantity")}
              style={{ width: "100%" }}
            />
          </div>

          {/* Orçamento */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Orçamento para os brindes</label>
            <input
              type="text"
              placeholder="R$ 0,00"
              value={form.budget}
              onChange={(e) => update("budget", formatCurrency(e.target.value))}
              className={inputClass("budget")}
              style={{ width: "100%" }}
            />
          </div>

          {/* Detalhes */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Detalhes do pedido</label>
            <textarea
              placeholder="Descreva o que precisa (opcional)"
              value={form.details}
              onChange={(e) => update("details", e.target.value)}
              rows={3}
              className={`${inputClass("details")} resize-none`}
              style={{ width: "100%" }}
            />
          </div>

          <button
            type="submit"
            className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-green-cta px-6 py-3.5 font-bold text-primary-foreground text-sm uppercase tracking-wide transition-all duration-200 hover:brightness-110"
            style={{ boxShadow: "0 0 24px rgba(34,197,94,0.3)" }}
          >
            <MessageCircle size={18} />
            Solicitar Orçamento no WhatsApp
          </button>
        </form>
      </div>
    </div>
  );
};

export default WhatsAppModal;
