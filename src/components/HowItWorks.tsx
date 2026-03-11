const steps = [
  { num: "01", title: "Escolha", desc: "Selecione os brindes do catálogo" },
  { num: "02", title: "Envie a logo", desc: "Envie sua marca em alta resolução" },
  { num: "03", title: "Receba layout", desc: "Aprovamos a arte juntos" },
  { num: "04", title: "Produção", desc: "Fabricação com qualidade" },
  { num: "05", title: "Entrega", desc: "Receba no prazo combinado" },
];

const HowItWorks = () => (
  <section className="py-12 bg-surface-alt">
    <div className="container">
      <h2 className="text-center text-foreground mb-10">
        Como funciona seu <span className="text-highlight">pedido</span>
      </h2>

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 md:gap-0 relative">
        <div className="hidden md:block absolute top-8 left-[10%] right-[10%] border-t-2 border-dashed border-border" />

        {steps.map((s, i) => (
          <div key={i} className="flex flex-col items-center text-center flex-1 relative z-10 group">
            <div className="w-16 h-16 rounded-full bg-green-cta flex items-center justify-center text-primary-foreground font-bold text-lg mb-3 group-hover:shadow-lg transition-all duration-200"
              style={{ boxShadow: "0 0 20px rgba(34,197,94,0.2)" }}
            >
              {s.num}
            </div>
            <h4 className="font-semibold text-foreground mb-1">{s.title}</h4>
            <p className="text-xs text-muted-foreground max-w-[140px]">{s.desc}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default HowItWorks;
