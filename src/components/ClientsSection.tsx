import { useEffect, useState, useCallback } from "react";
import { useInView } from "@/hooks/useInView";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";

const defaultLogos = [
  { src: "/logos/petrobras.png", alt: "Petrobras" },
  { src: "/logos/ambev.png", alt: "Ambev" },
  { src: "/logos/natura.png", alt: "Natura" },
  { src: "/logos/itau.png", alt: "Itaú" },
  { src: "/logos/bradesco.png", alt: "Bradesco" },
  { src: "/logos/vale.png", alt: "Vale" },
  { src: "/logos/embraer.png", alt: "Embraer" },
  { src: "/logos/gerdau.png", alt: "Gerdau" },
  { src: "/logos/vivo.png", alt: "Vivo" },
  { src: "/logos/tim.png", alt: "Tim" },
  { src: "/logos/globo.png", alt: "Globo" },
  { src: "/logos/weg.png", alt: "WEG" },
];

interface LogoItem { src: string; alt: string; }

const ClientsSection = () => {
  const { ref, inView } = useInView();
  const isMobile = useIsMobile();
  const visibleCount = isMobile ? 3 : 5;

  const [logos, setLogos] = useState<LogoItem[]>(defaultLogos);
  const [startIndex, setStartIndex] = useState(0);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    supabase
      .from("site_content")
      .select("id, value, label")
      .eq("section", "clientes")
      .order("id")
      .then(({ data }) => {
        if (!data) return;
        const dbLogos = data
          .filter(r => r.value)
          .map(r => ({ src: r.value!, alt: r.label || "" }));
        if (dbLogos.length > 0) setLogos(dbLogos);
      });
  }, []);

  const advance = useCallback(() => {
    if (animating) return;
    setAnimating(true);
    setTimeout(() => {
      setStartIndex(prev => (prev + 1) % logos.length);
      setAnimating(false);
    }, 400);
  }, [animating, logos.length]);

  useEffect(() => {
    const t = setInterval(advance, 2500);
    return () => clearInterval(t);
  }, [advance]);

  const visibleLogos = Array.from({ length: visibleCount }, (_, i) =>
    logos[(startIndex + i) % logos.length]
  );

  return (
    <section className="py-8 bg-background border-t border-border">
      <div
        ref={ref}
        className={`container transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`}
      >
        <h2 className="text-center text-foreground font-extrabold text-[32px] mb-2">
          Grandes clientes que confiam na{" "}
          <span className="text-highlight">Gift Web</span>
        </h2>
        <p className="text-center text-muted-foreground mb-6">
          Marcas que escolheram qualidade e personalização
        </p>

        <div
          className="mx-auto px-6 md:px-12"
          style={{ maxWidth: "1100px" }}
        >
          <div
            className={`grid items-center ${isMobile ? "grid-cols-3" : "grid-cols-5"}`}
            style={{
              gap: "32px",
              opacity: animating ? 0 : 1,
              transform: animating ? "translateX(-10px)" : "translateX(0)",
              transition: "opacity 0.4s ease, transform 0.4s ease",
            }}
          >
            {visibleLogos.map((logo, i) => (
              <div key={`${startIndex}-${i}`} className="flex justify-center items-center">
                <img
                  src={logo.src}
                  alt={logo.alt}
                  loading="lazy"
                  className="object-contain"
                  style={{
                    height: "80px",
                    width: "auto",
                    maxWidth: "160px",
                    opacity: 0.85,
                    transition: "opacity 0.2s ease",
                  }}
                  onMouseEnter={e => { (e.target as HTMLImageElement).style.opacity = "1"; }}
                  onMouseLeave={e => { (e.target as HTMLImageElement).style.opacity = "0.85"; }}
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
