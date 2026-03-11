import { FileText, ArrowRight } from "lucide-react";
import { useInView } from "@/hooks/useInView";

const banners = [
  { title: "Catálogo Geral", subtitle: "Todos os nossos produtos em um só lugar" },
  { title: "Catálogo Corporativo", subtitle: "Soluções exclusivas para empresas" },
];

const CatalogSection = () => {
  const { ref, inView } = useInView();

  return (
    <section className="py-20 md:py-20 bg-background">
      <div
        ref={ref}
        className={`container transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`}
      >
        <h2 className="text-foreground font-extrabold text-[32px] mb-8">
          Baixe nosso <span className="text-highlight">catálogo</span>
        </h2>

        <div className="flex flex-col gap-4">
          {banners.map((b, i) => (
            <a
              key={i}
              href="#"
              className="relative flex items-center gap-6 rounded-[16px] border border-border p-6 h-[120px] transition-all duration-200 group hover:border-green-cta overflow-hidden"
              style={{ background: "linear-gradient(135deg, hsl(210 40% 13%), hsl(221 39% 11%))" }}
            >
              {/* PDF badge */}
              <span className="absolute top-3 right-3 rounded-md bg-green-cta px-2 py-0.5 text-xs font-bold text-primary-foreground uppercase">
                PDF
              </span>

              <div className="w-12 h-12 rounded-xl bg-green-cta/10 flex items-center justify-center flex-shrink-0">
                <FileText size={24} className="text-green-cta" />
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="font-extrabold text-foreground text-xl">{b.title}</h3>
                <p className="text-muted-foreground text-sm mt-1">{b.subtitle}</p>
              </div>

              <ArrowRight
                size={24}
                className="text-muted-foreground flex-shrink-0 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-green-cta"
              />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CatalogSection;
