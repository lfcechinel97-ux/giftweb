import { useEffect, useState } from "react";
import { useInView } from "@/hooks/useInView";

const testimonials = [
  {
    text: "A Gift Web superou nossas expectativas. Os brindes personalizados chegaram impecáveis e no prazo!",
    name: "Mariana Costa",
    company: "Empresa ABC",
    role: "Marketing",
    photo: "https://i.pravatar.cc/80?img=32",
  },
  {
    text: "Qualidade excelente e atendimento diferenciado. Já fizemos mais de 10 pedidos e todos foram perfeitos.",
    name: "Ricardo Almeida",
    company: "Grupo XYZ",
    role: "Compras",
    photo: "https://i.pravatar.cc/80?img=12",
  },
  {
    text: "Nosso evento corporativo foi um sucesso graças aos kits personalizados. Recomendo demais!",
    name: "Fernanda Oliveira",
    company: "Tech Corp Coach",
    role: "Eventos",
    photo: "https://i.pravatar.cc/80?img=25",
  },
  {
    text: "Parceiros de confiança. Sempre entregam com qualidade e pontualidade, mesmo em grandes volumes.",
    name: "Lucas Santos",
    company: "StartUp Inc",
    role: "Diretoria",
    photo: "https://i.pravatar.cc/80?img=53",
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
    <section className="py-8 md:py-10 bg-surface-alt">
      <div
        ref={ref}
        className={`container transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`}
      >
        {/* Desktop */}
        <div className="hidden md:grid grid-cols-3 gap-6">
          {getVisible().map((t, i) => (
            <TestimonialCard key={`${t.name}-${current}-${i}`} {...t} delay={i * 100} />
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
              className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                i === current ? "bg-green-cta" : "bg-border"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

const TestimonialCard = ({ text, name, company, role, photo, delay }: { text: string; name: string; company: string; role: string; photo: string; delay: number }) => (
  <div
    className="rounded-[20px] bg-card border border-border p-6 transition-all duration-500 hover:border-green-cta hover:shadow-[0_8px_40px_rgba(34,197,94,0.08)]"
    style={{
      animation: `fadeSlideIn 0.6s ease-out ${delay}ms both`,
    }}
  >
    <span className="text-green-cta/30 font-black text-6xl leading-none select-none">"</span>
    <p className="text-muted-foreground text-[15px] leading-relaxed line-clamp-3 -mt-3 mb-4">
      {text}
    </p>
    <div className="border-t border-border pt-4 flex items-center gap-3">
      <img
        src={photo}
        alt={name}
        className="w-12 h-12 rounded-full object-cover border-2 border-border"
      />
      <div>
        <p className="font-bold text-foreground text-sm">{name}</p>
        <p className="text-green-cta text-[12px]">{role} · {company}</p>
      </div>
    </div>
  </div>
);

export default TestimonialsSection;
