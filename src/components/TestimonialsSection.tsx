import { useEffect, useState } from "react";
import { useInView } from "@/hooks/useInView";

const testimonials = [
  {
    text: "A Gift Web superou nossas expectativas. Os brindes personalizados chegaram impecáveis e no prazo!",
    name: "Mariana Costa",
    role: "Marketing · Empresa ABC",
  },
  {
    text: "Qualidade excelente e atendimento diferenciado. Já fizemos mais de 10 pedidos e todos foram perfeitos.",
    name: "Ricardo Almeida",
    role: "Compras · Grupo XYZ",
  },
  {
    text: "Nosso evento corporativo foi um sucesso graças aos kits personalizados. Recomendo demais!",
    name: "Fernanda Oliveira",
    role: "Eventos · Tech Corp",
  },
  {
    text: "Parceiros de confiança. Sempre entregam com qualidade e pontualidade, mesmo em grandes volumes.",
    name: "Lucas Santos",
    role: "Diretoria · StartUp Inc",
  },
];

const TestimonialsSection = () => {
  const { ref, inView } = useInView();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setCurrent((c) => (c + 1) % testimonials.length), 5000);
    return () => clearInterval(timer);
  }, []);

  // visible slides for desktop (3) and mobile (1)
  const getVisible = () => {
    const result = [];
    for (let i = 0; i < 3; i++) {
      result.push(testimonials[(current + i) % testimonials.length]);
    }
    return result;
  };

  return (
    <section className="py-20 md:py-20 bg-background">
      <div
        ref={ref}
        className={`container transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`}
      >
        <h2 className="text-center text-foreground font-extrabold text-[32px] mb-10">
          O que nossos <span className="text-highlight">clientes dizem</span>
        </h2>

        {/* Desktop */}
        <div className="hidden md:grid grid-cols-3 gap-6">
          {getVisible().map((t, i) => (
            <TestimonialCard key={`${t.name}-${i}`} {...t} />
          ))}
        </div>

        {/* Mobile */}
        <div className="md:hidden">
          <TestimonialCard {...testimonials[current]} />
        </div>

        {/* Dots */}
        <div className="flex justify-center gap-2 mt-8">
          {testimonials.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`w-2.5 h-2.5 rounded-full transition-colors duration-200 ${
                i === current ? "bg-green-cta" : "bg-border"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

const TestimonialCard = ({ text, name, role }: { text: string; name: string; role: string }) => (
  <div className="rounded-[20px] bg-card border border-border p-7 transition-all duration-250 hover:border-green-cta hover:shadow-[0_8px_40px_rgba(34,197,94,0.08)]">
    <span className="text-green-cta/30 font-black text-7xl leading-none select-none">"</span>
    <p className="text-muted-foreground text-[15px] leading-relaxed line-clamp-3 -mt-4 mb-5">
      {text}
    </p>
    <div className="border-t border-border pt-5 flex items-center gap-3">
      <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-foreground font-bold text-sm">
        {name.split(" ").map((n) => n[0]).join("")}
      </div>
      <div>
        <p className="font-bold text-foreground">{name}</p>
        <p className="text-green-cta text-[13px]">{role}</p>
      </div>
    </div>
  </div>
);

export default TestimonialsSection;
