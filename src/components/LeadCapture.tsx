import { useState } from "react";

const LeadCapture = () => {
  const [form, setForm] = useState({ name: "", email: "", company: "" });

  return (
    <section className="bg-navy py-12">
      <div className="container max-w-2xl text-center">
        <h2 className="text-2xl md:text-3xl text-primary-foreground mb-2">
          Ganhe 5% de desconto na primeira compra
        </h2>
        <p className="text-primary-foreground/70 mb-8">Cadastre-se e receba ofertas exclusivas</p>

        <form
          onSubmit={(e) => e.preventDefault()}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          <input
            type="text"
            placeholder="Seu nome"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="rounded-lg bg-primary-foreground/10 border border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-cta/60"
          />
          <input
            type="email"
            placeholder="Seu e-mail"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="rounded-lg bg-primary-foreground/10 border border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-cta/60"
          />
          <input
            type="text"
            placeholder="Empresa (opcional)"
            value={form.company}
            onChange={(e) => setForm({ ...form, company: e.target.value })}
            className="rounded-lg bg-primary-foreground/10 border border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-cta/60"
          />
          <button
            type="submit"
            className="rounded-lg bg-green-cta px-6 py-3 font-semibold text-accent-foreground hover:brightness-110 transition"
          >
            Cadastrar
          </button>
        </form>
      </div>
    </section>
  );
};

export default LeadCapture;
