import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { WHATSAPP_NUMBER } from "@/config/site";

interface WhatsAppModalProps {
  open: boolean;
  onClose: () => void;
}

const BUDGET_OPTIONS = [
  "Até R$ 1.000,00",
  "Até R$ 3.000,00",
  "Até R$ 5.000,00",
  "Acima de R$ 5.001,00",
];

const WhatsAppModal = ({ open, onClose }: WhatsAppModalProps) => {
  const [form, setForm] = useState({
    name: "",
    cpfCnpj: "",
    phone: "",
    email: "",
    budget: BUDGET_OPTIONS[0],
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const setField = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const name = form.name.trim().slice(0, 100);
    const cpfCnpj = form.cpfCnpj.trim().slice(0, 30);
    const phone = form.phone.trim().slice(0, 30);
    const email = form.email.trim().slice(0, 120);
    const budget = form.budget;

    const lines = [
      "Olá, tudo bem? Vim pelo site Gift Web Brindes e gostaria de uma cotação.",
      "",
      `Nome: ${name}`,
      `CPF/CNPJ: ${cpfCnpj}`,
      `Telefone: ${phone}`,
      `Email: ${email}`,
      `Orçamento: ${budget}`,
    ];
    const text = lines.join("\n");
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;

    // Programmatic user-initiated navigation (avoids window.open popup blockers)
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    onClose();
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="wa-modal-title"
      className="fixed inset-0 z-[200] flex items-end md:items-center justify-center bg-black/60 p-0 md:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-card rounded-t-2xl md:rounded-2xl border border-border shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 p-5 border-b border-border bg-green-cta/5">
          <div>
            <h3 id="wa-modal-title" className="font-extrabold text-lg text-foreground">
              Tire suas dúvidas agora!
            </h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Irei fazer seu atendimento agora. Preencha os dados abaixo e nossa equipe
              entrará em contato para ajudar com seu orçamento.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="shrink-0 text-muted-foreground hover:text-foreground transition-colors p-1"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-3">
          <Field
            label="Nome"
            value={form.name}
            onChange={(v) => setField("name", v)}
            required
            maxLength={100}
            placeholder="Seu nome completo"
          />
          <Field
            label="CPF / CNPJ"
            value={form.cpfCnpj}
            onChange={(v) => setField("cpfCnpj", v)}
            maxLength={30}
            placeholder="000.000.000-00"
          />
          <Field
            label="Telefone"
            value={form.phone}
            onChange={(v) => setField("phone", v)}
            type="tel"
            required
            maxLength={30}
            placeholder="(00) 00000-0000"
          />
          <Field
            label="Email"
            value={form.email}
            onChange={(v) => setField("email", v)}
            type="email"
            maxLength={120}
            placeholder="seu@email.com"
          />

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-foreground">
              Orçamento para seus brindes
            </label>
            <select
              value={form.budget}
              onChange={(e) => setField("budget", e.target.value)}
              className="w-full rounded-lg border border-border bg-background py-2.5 px-3 text-sm text-foreground focus:border-green-cta focus:outline-none focus:ring-1 focus:ring-green-cta/30"
            >
              {BUDGET_OPTIONS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="mt-2 w-full rounded-xl bg-green-cta py-3.5 font-bold text-white text-sm uppercase tracking-wide hover:brightness-110 active:scale-[0.99] transition-all"
            style={{ boxShadow: "0 6px 20px rgba(34,197,94,0.35)" }}
          >
            Enviar para o WhatsApp
          </button>
          <p className="text-[11px] text-center text-muted-foreground">
            Você será direcionado para o WhatsApp com a mensagem já preenchida.
          </p>
        </form>
      </div>
    </div>
  );
};

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  maxLength?: number;
  placeholder?: string;
}

const Field = ({ label, value, onChange, type = "text", required, maxLength, placeholder }: FieldProps) => (
  <div className="flex flex-col gap-1">
    <label className="text-xs font-semibold text-foreground">
      {label}
      {required && <span className="text-green-cta ml-0.5">*</span>}
    </label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      maxLength={maxLength}
      placeholder={placeholder}
      className="w-full rounded-lg border border-border bg-background py-2.5 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-green-cta focus:outline-none focus:ring-1 focus:ring-green-cta/30"
    />
  </div>
);

export default WhatsAppModal;
