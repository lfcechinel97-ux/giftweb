import { useState } from "react";
import { X, MessageCircle } from "lucide-react";

interface WhatsAppModalProps {
  open: boolean;
  onClose: () => void;
}

const budgetOptions = [
  "Até R$ 1.000,00",
  "Até R$ 3.000,00",
  "Até R$ 5.000,00",
  "Acima de R$ 5.001,00",
];

const WhatsAppModal = ({ open, onClose }: WhatsAppModalProps) => {
  const [form, setForm] = useState({
    greeting: "",
    cpfCnpj: "",
    name: "",
    phone: "",
    email: "",
    budget: "",
  });

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const message = [
      `Olá! ${form.greeting}`,
      `Nome: ${form.name}`,
      `CPF/CNPJ: ${form.cpfCnpj}`,
      `Telefone: ${form.phone}`,
      `Email: ${form.email}`,
      `Orçamento: ${form.budget}`,
    ].join("\n");

    window.open(
      `https://wa.me/5548996652844?text=${encodeURIComponent(message)}`,
      "_blank"
    );
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-md rounded-2xl bg-card border border-border p-6 animate-scale-in overflow-y-auto max-h-[90vh]"
        style={{ boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}
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
          <h3 className="text-foreground font-bold text-lg">Tire suas dúvidas agora!</h3>
        </div>

        <p className="text-muted-foreground text-sm mb-5 leading-relaxed">
          Irei fazer seu atendimento agora. Preencha os dados abaixo e nossa equipe entrará em contato para ajudar com seu orçamento.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="Olá, tudo bem?"
            value={form.greeting}
            onChange={(e) => update("greeting", e.target.value)}
            className="rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-green-cta/40"
          />
          <input
            type="text"
            placeholder="CPF / CNPJ"
            value={form.cpfCnpj}
            onChange={(e) => update("cpfCnpj", e.target.value)}
            className="rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-green-cta/40"
          />
          <input
            type="text"
            placeholder="Nome"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            required
            className="rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-green-cta/40"
          />
          <input
            type="tel"
            placeholder="Telefone"
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
            required
            className="rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-green-cta/40"
          />
          <input
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            className="rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-green-cta/40"
          />

          <select
            value={form.budget}
            onChange={(e) => update("budget", e.target.value)}
            required
            className="rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-green-cta/40 appearance-none"
          >
            <option value="" disabled>Orçamento para seus brindes</option>
            {budgetOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>

          <button
            type="submit"
            className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-green-cta px-6 py-3.5 font-bold text-primary-foreground text-sm uppercase tracking-wide transition-all duration-200 hover:brightness-110"
            style={{ boxShadow: "0 0 24px rgba(34,197,94,0.3)" }}
          >
            <MessageCircle size={18} />
            Enviar via WhatsApp
          </button>
        </form>
      </div>
    </div>
  );
};

export default WhatsAppModal;
