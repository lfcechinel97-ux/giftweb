import { useState } from "react";

const LeadCapture = () => {
  const [form, setForm] = useState({ name: "", email: "", company: "" });

  return (
    <section className="py-12" style={{ background: "linear-gradient(135deg, hsl(222,47%,7%) 0%, hsl(210,50%,13%) 100%)" }}>
      <div className="container max-w-2xl text-center">
        <h2 className="text-foreground mb-2">
          Ganhe 5% de <span className="text-highlight">desconto</span> na primeira compra
        </h2>
        <p className="text-muted-foreground mb-8">Cadastre-se e receba ofertas exclusivas</p>

        <form
          onSubmit={(e) => e.preventDefault()}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          <input
            type="text"
            placeholder="Seu nome"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="rounded-[10px] bg-card border border-border text-foreground placeholder:text-text-meta px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-cta/60 transition-all duration-200"
          />
          <input
            type="email"
            placeholder="Seu e-mail"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="rounded-[10px] bg-card border border-border text-foreground placeholder:text-text-meta px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-cta/60 transition-all duration-200"
          />
          <input
            type="text"
            placeholder="Empresa (opcional)"
            value={form.company}
            onChange={(e) => setForm({ ...form, company: e.target.value })}
            className="rounded-[10px] bg-card border border-border text-foreground placeholder:text-text-meta px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-cta/60 transition-all duration-200"
          />
          <button
            type="submit"
            className="rounded-[10px] bg-green-cta px-6 py-3 font-bold text-primary-foreground hover:brightness-110 transition-all duration-200"
            style={{ boxShadow: "0 0 20px rgba(34,197,94,0.2)" }}
          >
            Cadastrar
          </button>
        </form>
      </div>
    </section>
  );
};

export default LeadCapture;
