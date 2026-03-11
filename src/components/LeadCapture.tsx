import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const LeadCapture = () => {
  const [form, setForm] = useState({ name: "", email: "", company: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "duplicate" | "error">("idle");

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidEmail(form.email)) return;
    setStatus("loading");

    const { error } = await supabase.from("leads").insert({
      nome: form.name.trim() || null,
      email: form.email.trim(),
      empresa: form.company.trim() || null,
    });

    if (!error) {
      setStatus("success");
      setForm({ name: "", email: "", company: "" });
    } else if (error.code === "23505") {
      setStatus("duplicate");
    } else {
      setStatus("error");
    }
  };

  return (
    <section className="py-12" style={{ background: "linear-gradient(135deg, hsl(222,47%,7%) 0%, hsl(210,50%,13%) 100%)" }}>
      <div className="container max-w-2xl text-center">
        <h2 className="text-foreground mb-2">
          Ganhe 5% de <span className="text-highlight">desconto</span> na primeira compra
        </h2>
        <p className="text-muted-foreground mb-8">Cadastre-se e receba ofertas exclusivas</p>

        {status === "success" ? (
          <p className="text-green-cta font-bold text-lg">Cadastro realizado! Seu desconto foi enviado. ✅</p>
        ) : (
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              required
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
              disabled={status === "loading"}
              className="rounded-[10px] bg-green-cta px-6 py-3 font-bold text-primary-foreground hover:brightness-110 transition-all duration-200 disabled:opacity-60"
              style={{ boxShadow: "0 0 20px rgba(34,197,94,0.2)" }}
            >
              {status === "loading" ? "Enviando..." : "Cadastrar"}
            </button>
            {status === "duplicate" && <p className="text-muted-foreground text-sm sm:col-span-2">Este e-mail já está cadastrado.</p>}
            {status === "error" && <p className="text-destructive text-sm sm:col-span-2">Erro ao cadastrar. Tente novamente.</p>}
          </form>
        )}
      </div>
    </section>
  );
};

export default LeadCapture;
