import { useInView } from "@/hooks/useInView";

const steps = [
  {
    num: "01",
    title: "Escolha o produto",
    desc: "Explore nosso catálogo com centenas de brindes corporativos prontos para personalizar.",
    img: "https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=600",
  },
  {
    num: "02",
    title: "Envie sua logo",
    desc: "Mande o arquivo da sua marca por WhatsApp ou e-mail. Aceitamos AI, PDF, PNG e SVG.",
    img: "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=600",
  },
  {
    num: "03",
    title: "Aprove a arte",
    desc: "Nossa equipe cria o mock-up gratuitamente. Você aprova antes de qualquer produção.",
    img: "https://images.unsplash.com/photo-1586717791821-3f44a563fa4c?w=600",
  },
  {
    num: "04",
    title: "Produção",
    desc: "Fabricação com controle de qualidade. Você recebe fotos do lote antes do envio.",
    img: "https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=600",
    badge: "⚡ 2 a 7 dias úteis",
  },
  {
    num: "05",
    title: "Entrega",
    desc: "Enviamos para todo o Brasil com rastreamento em tempo real.",
    img: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600",
  },
];

const HowItWorks = () => {
  const { ref, inView } = useInView();

  return (
    <section className="py-16 md:py-20 overflow-hidden" style={{ background: "#0B0F1A" }}>
      <div
        ref={ref}
        className={`transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`}
      >
        <div className="text-center mb-12 px-4">
          <h2 className="text-white font-extrabold text-[28px] md:text-[34px] tracking-tight">
            Seu pedido, do início ao <span className="text-primary italic font-black">fim</span>
          </h2>
          <p className="text-[14px] mt-2 text-white/50 font-medium">
            Simples, rápido e sem complicação.
          </p>
        </div>

        {/* Desktop grid + Mobile horizontal scroll */}
        <div className="relative max-w-[1200px] mx-auto px-6">
          {/* Decorative connector line */}
          <div
            className="hidden md:block absolute top-1/2 left-[5%] right-[5%] h-px pointer-events-none"
            style={{ background: "linear-gradient(to right, transparent, rgba(34,197,94,0.22), transparent)" }}
          />

          <div
            className="
              grid gap-3
              grid-cols-[repeat(5,260px)] md:grid-cols-5
              overflow-x-auto md:overflow-visible
              snap-x snap-mandatory md:snap-none
              pb-4 md:pb-0
              scrollbar-hide
            "
          >
            {steps.map((s) => (
              <div
                key={s.num}
                className="
                  group relative rounded-2xl overflow-hidden cursor-default
                  h-[300px] md:h-[340px] snap-start
                "
                style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}
              >
                {/* Photo */}
                <img
                  src={s.img}
                  alt={s.title}
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover transition-all duration-500 ease-out brightness-[0.5] group-hover:scale-[1.06] group-hover:brightness-[0.65]"
                />

                {/* Base gradient overlay */}
                <div
                  className="absolute inset-0"
                  style={{
                    background: "linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.18) 55%, transparent 100%)",
                  }}
                />
                {/* Hover overlay */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-400"
                  style={{
                    background: "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.42) 60%, rgba(0,0,0,0.1) 100%)",
                  }}
                />

                {/* Green top accent line */}
                <div
                  className="absolute top-0 left-0 right-0 h-[3px] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ background: "linear-gradient(to right, transparent, hsl(142 71% 45%), transparent)" }}
                />

                {/* Content */}
                <div className="absolute inset-0 p-5 md:p-6 flex flex-col justify-end">
                  <span
                    className="text-[44px] font-black leading-none mb-auto transition-all duration-300"
                    style={{ color: "rgba(34,197,94,0.2)" }}
                  >
                    <span className="group-hover:hidden">{s.num}</span>
                    <span className="hidden group-hover:inline" style={{ color: "rgba(34,197,94,0.4)" }}>
                      {s.num}
                    </span>
                  </span>

                  {s.badge && (
                    <span
                      className="inline-block w-fit text-[10px] font-bold uppercase tracking-wider text-white rounded-full px-2.5 py-[3px] mb-2"
                      style={{ background: "hsl(142 71% 38%)", letterSpacing: "0.5px" }}
                    >
                      {s.badge}
                    </span>
                  )}

                  <h3 className="text-white text-[16px] font-bold leading-tight mb-1.5">
                    {s.title}
                  </h3>

                  <p
                    className="text-[12px] leading-relaxed max-h-0 overflow-hidden opacity-0 group-hover:max-h-20 group-hover:opacity-100 transition-all duration-400"
                    style={{ color: "#D1FAE5" }}
                  >
                    {s.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
