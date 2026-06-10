import { useEffect, useState } from "react";
import { X, ChevronDown } from "lucide-react";
import { WHATSAPP_NUMBER } from "@/config/site";
import { CATEGORY_GROUPS } from "@/config/categoryGroups";

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

const ITEM_OPTIONS = ["Ainda não sei", ...CATEGORY_GROUPS.map((g) => g.title)];

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

const WhatsAppModal = ({ open, onClose }: WhatsAppModalProps) => {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    item: ITEM_OPTIONS[0],
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
    const phone = form.phone.trim().slice(0, 30);
    const item = form.item;
    const budget = form.budget;

    const lines = [
      "Olá, tudo bem? Vim pelo site Gift Web Brindes e gostaria de uma cotação.",
      "",
      `Nome: ${name}`,
      `Telefone: ${phone}`,
      `Item interessado: ${item}`,
      `Orçamento: ${budget}`,
    ];
    const text = lines.join("\n");
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;

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
              Preencha os dados abaixo e nossa equipe entrará em contato para ajudar
              com seu orçamento.
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

        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-3.5">
          <FieldText
            label="Nome"
            value={form.name}
            onChange={(v) => setField("name", v)}
            required
            maxLength={100}
            placeholder="Seu nome completo"
            autoComplete="name"
          />
          <FieldText
            label="Telefone"
            value={form.phone}
            onChange={(v) => setField("phone", formatPhone(v))}
            type="tel"
            required
            maxLength={16}
            placeholder="(00) 00000-0000"
            inputMode="tel"
            autoComplete="tel"
          />

          <FieldSelect
            label="Item interessado"
            value={form.item}
            onChange={(v) => setField("item", v)}
            options={ITEM_OPTIONS}
          />

          <FieldSelect
            label="Orçamento para seus brindes"
            value={form.budget}
            onChange={(v) => setField("budget", v)}
            options={BUDGET_OPTIONS}
          />

          <button
            type="submit"
            className="mt-2 w-full rounded-full bg-green-cta py-3.5 font-bold text-white text-sm uppercase tracking-wide hover:brightness-110 active:scale-[0.99] transition-all"
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

interface FieldTextProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  maxLength?: number;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  autoComplete?: string;
}

const FieldText = ({
  label,
  value,
  onChange,
  type = "text",
  required,
  maxLength,
  placeholder,
  inputMode,
  autoComplete,
}: FieldTextProps) => (
  <div className="flex flex-col gap-1.5">
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
      inputMode={inputMode}
      autoComplete={autoComplete}
      className="w-full rounded-full border border-border bg-background py-2.5 px-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-green-cta focus:outline-none focus:ring-2 focus:ring-green-cta/20"
    />
  </div>
);

interface FieldSelectProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}

const FieldSelect = ({ label, value, onChange, options }: FieldSelectProps) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-semibold text-foreground">{label}</label>
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none rounded-full border border-border bg-background py-2.5 pl-4 pr-10 text-sm text-foreground focus:border-green-cta focus:outline-none focus:ring-2 focus:ring-green-cta/20"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <ChevronDown
        size={16}
        className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-green-cta"
      />
    </div>
  </div>
);

export default WhatsAppModal;
