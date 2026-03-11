import { useInView } from "@/hooks/useInView";

const companies = [
  "Petrobras", "Ambev", "Natura", "Magazine Luiza", "Itaú", "Bradesco",
  "Vale", "JBS", "Renner", "Localiza", "Totvs", "Raia Drogasil",
  "WEG", "Suzano", "Hapvida", "Energisa", "CPFL", "Vivo",
  "Tim", "Claro", "Globo", "Embraer", "Gerdau", "BRF",
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
          <div className="flex gap-6 animate-scroll-clients hover:[animation-play-state:paused] w-max">
            {looped.map((name, i) => (
              <div
                key={i}
                className="w-[100px] h-[40px] rounded-md bg-card border border-border flex items-center justify-center flex-shrink-0 grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all duration-300"
              >
                <span className="text-muted-foreground text-[10px] font-semibold">{name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ClientsSection;
