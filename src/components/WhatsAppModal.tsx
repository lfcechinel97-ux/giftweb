import { useState } from "react";
import { X, MessageCircle } from "lucide-react";

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
          <div className="w-10 h-10 rounded-full bg-green-cta flex items-center justify-center">
            <MessageCircle size={20} className="text-primary-foreground" />
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
