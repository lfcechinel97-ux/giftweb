import { useInView } from "@/hooks/useInView";

const companies = [
  { name: "Petrobras", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/Petrobras_logo.svg/120px-Petrobras_logo.svg.png" },
  { name: "Ambev", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/Ambev_logo.svg/120px-Ambev_logo.svg.png" },
  { name: "Natura", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Natura_logo.svg/120px-Natura_logo.svg.png" },
  { name: "Itaú", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8a/Banco_Ita%C3%BA_logo.svg/120px-Banco_Ita%C3%BA_logo.svg.png" },
  { name: "Bradesco", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/Bradesco_logo_%282018%29.svg/120px-Bradesco_logo_%282018%29.svg.png" },
  { name: "Vale", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Vale_logo.svg/120px-Vale_logo.svg.png" },
  { name: "Embraer", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0b/Embraer_logo_%282018%29.svg/120px-Embraer_logo_%282018%29.svg.png" },
  { name: "Gerdau", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Gerdau_logo_%282011%29.svg/120px-Gerdau_logo_%282011%29.svg.png" },
  { name: "Vivo", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/Vivo_logo_2021.svg/120px-Vivo_logo_2021.svg.png" },
  { name: "Tim", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Tim_logo_2016.svg/120px-Tim_logo_2016.svg.png" },
  { name: "Globo", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Globo_logo_%28corporate%29.svg/120px-Globo_logo_%28corporate%29.svg.png" },
  { name: "WEG", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Weg_logo.svg/120px-Weg_logo.svg.png" },
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
          <div className="flex gap-8 animate-scroll-clients hover:[animation-play-state:paused] w-max items-center">
            {looped.map((company, i) => (
              <div
                key={i}
                className="w-[120px] h-[50px] rounded-lg bg-card border border-border flex items-center justify-center flex-shrink-0 grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all duration-500 p-2"
              >
                <img
                  src={company.logo}
                  alt={company.name}
                  className="max-h-full max-w-full object-contain"
                  loading="lazy"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = "none";
                    target.parentElement!.innerHTML = `<span class="text-muted-foreground text-[10px] font-semibold">${company.name}</span>`;
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
