import { useEffect, useState } from "react";
import { useInView } from "@/hooks/useInView";
import { Star } from "lucide-react";

const testimonials = [
  {
    text: "A Gift Web superou nossas expectativas. Os brindes personalizados chegaram impecáveis e no prazo!",
    name: "Mariana Costa",
    company: "Embraer",
    role: "Marketing",
    photo: "",
  },
  {
    text: "Qualidade excelente e atendimento diferenciado. Já fizemos mais de 10 pedidos e todos foram perfeitos.",
    name: "Ricardo Almeida",
    company: "Grupo XYZ",
    role: "Compras",
    photo: "",
  },
  {
    text: "Nosso evento corporativo foi um sucesso graças aos kits personalizados. Recomendo demais!",
    name: "Fernanda Oliveira",
    company: "Tech Corp Coach",
    role: "Eventos",
    photo: "",
  },
  {
    text: "Parceiros de confiança. Sempre entregam com qualidade e pontualidade, mesmo em grandes volumes.",
    name: "Lucas Santos",
    company: "StartUp Inc",
    role: "Diretoria",
    photo: "",
  },
];

const TestimonialsSection = () => {
  const { ref, inView } = useInView();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setCurrent((c) => (c + 1) % testimonials.length), 9000);
    return () => clearInterval(timer);
  }, []);

  const getVisible = () => {
    const result = [];
    for (let i = 0; i < 3; i++) {
      result.push(testimonials[(current + i) % testimonials.length]);
    }
    return result;
  };

  return (
    <section className="py-10 md:py-14 bg-background">
      <div
        ref={ref}
        className={`container transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`}
      >
        <div className="text-center mb-8">
          <h2 className="text-foreground font-extrabold text-[28px] md:text-[32px]">
            O que nossos <span className="text-highlight">clientes</span> dizem
          </h2>
          <p className="text-muted-foreground text-sm mt-1.5">Mais de 500 empresas atendidas em todo o Brasil</p>
        </div>

        {/* Desktop */}
        <div className="hidden md:grid grid-cols-3 gap-5">
          {getVisible().map((t, i) => (
            <TestimonialCard key={`${t.name}-${current}-${i}`} {...t} delay={i * 80} />
          ))}
        </div>

        {/* Mobile */}
        <div className="md:hidden">
          <TestimonialCard key={`mobile-${current}`} {...testimonials[current]} delay={0} />
        </div>

        {/* Dots */}
        <div className="flex justify-center gap-2 mt-6">
          {testimonials.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === current ? "bg-primary w-5" : "bg-border w-2.5"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

const TestimonialCard = ({
  text, name, company, role, photo, delay
}: {
  text: string; name: string; company: string; role: string; photo: string; delay: number;
}) => (
  <div
    className="rounded-2xl bg-card border border-border p-6 flex flex-col transition-all duration-300 hover:border-primary/30"
    style={{
      animation: `fadeSlideIn 0.55s cubic-bezier(0.16,1,0.3,1) ${delay}ms both`,
      boxShadow: "0 1px 6px rgba(0,0,0,0.04)",
    }}
    onMouseEnter={(e) => {
      (e.currentTarget as HTMLElement).style.boxShadow = "0 6px 20px rgba(0,0,0,0.07)";
    }}
    onMouseLeave={(e) => {
      (e.currentTarget as HTMLElement).style.boxShadow = "0 1px 6px rgba(0,0,0,0.04)";
    }}
  >
    {/* Stars */}
    <div className="flex gap-0.5 mb-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={13} className="text-amber-400 fill-amber-400" />
      ))}
    </div>

    <p className="text-muted-foreground text-[14px] leading-relaxed line-clamp-3 mb-5 flex-1">
      "{text}"
    </p>

    <div className="border-t border-border pt-4 flex items-center gap-3">
      <img
        src={photo}
        alt={name}
        className="w-10 h-10 rounded-full object-cover border-2 border-border flex-shrink-0"
      />
      <div>
        <p className="font-semibold text-foreground text-sm leading-tight">{name}</p>
        <p className="text-primary text-[11px] mt-0.5">{role} · {company}</p>
      </div>
    </div>
  </div>
);

export default TestimonialsSection;
