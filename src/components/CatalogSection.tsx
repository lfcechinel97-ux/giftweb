import { useInView } from "@/hooks/useInView";
import catalogGeral from "@/assets/catalog-geral.png";
import catalogCorporativo from "@/assets/catalog-corporativo.png";

const banners = [
  { title: "Catálogo Geral", img: catalogGeral, href: "#" },
  { title: "Catálogo Corporativo", img: catalogCorporativo, href: "#" },
];

const CatalogSection = () => {
  const { ref, inView } = useInView();

  return (
    <section className="py-10 md:py-12 bg-background">
      <div
        ref={ref}
        className={`container transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`}
      >
        <h2 className="text-foreground font-extrabold text-[32px] mb-6">
          Baixe nosso <span className="text-highlight">catálogo</span>
        </h2>

        <div className="flex flex-col md:flex-row gap-4 items-center justify-center">
          {banners.map((b, i) => (
            <a
              key={i}
              href={b.href}
              className="group block w-full max-w-xs transition-transform duration-200 hover:scale-[1.02]"
            >
              <img
                src={b.img}
                alt={b.title}
                className="w-full h-auto object-contain drop-shadow-2xl"
              />
              <p className="text-center text-foreground font-bold text-lg mt-2">{b.title}</p>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CatalogSection;
