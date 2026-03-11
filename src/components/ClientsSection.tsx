import { useInView } from "@/hooks/useInView";

const companies = [
  { name: "Petrobras", logo: "/logos/petrobras.png" },
  { name: "Ambev", logo: "/logos/ambev.png" },
  { name: "Natura", logo: "/logos/natura.png" },
  { name: "Itaú", logo: "/logos/itau.png" },
  { name: "Bradesco", logo: "/logos/bradesco.png" },
  { name: "Vale", logo: "/logos/vale.png" },
  { name: "Embraer", logo: "/logos/embraer.png" },
  { name: "Gerdau", logo: "/logos/gerdau.png" },
  { name: "Vivo", logo: "/logos/vivo.png" },
  { name: "Tim", logo: "/logos/tim.png" },
  { name: "Globo", logo: "/logos/globo.png" },
  { name: "WEG", logo: "/logos/weg.png" },
];

const looped = [...companies, ...companies];

const ClientsSection = () => {
  const { ref, inView } = useInView();

  return (
    <section className="py-8 bg-surface-alt border-t border-b border-border">
      <div
        ref={ref}
        className={`container transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`}
      >
        <h2 className="text-center text-foreground font-extrabold text-[32px] mb-2">
          Grandes clientes que confiam na <span className="text-highlight">Gift Web</span>
        </h2>
        <p className="text-center text-muted-foreground mb-6">
          Marcas que escolheram qualidade e personalização
        </p>

        <div className="overflow-hidden">
          <div className="flex gap-10 animate-scroll-clients hover:[animation-play-state:paused] w-max items-center">
            {looped.map((company, i) => (
              <div
                key={i}
                className="w-[140px] h-[60px] rounded-lg bg-card border border-border flex items-center justify-center flex-shrink-0 grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all duration-500 p-3"
              >
                <img
                  src={company.logo}
                  alt={company.name}
                  className="max-h-full max-w-full object-contain brightness-0 invert opacity-80"
                  loading="lazy"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = "none";
                    target.parentElement!.innerHTML = `<span class="text-muted-foreground text-xs font-bold tracking-wide uppercase">${company.name}</span>`;
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ClientsSection;
