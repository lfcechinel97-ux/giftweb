import { useEffect, useState } from "react";
import { useInView } from "@/hooks/useInView";
import { supabase } from "@/integrations/supabase/client";

const defaultLogos = [
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

interface LogoItem {
  src: string;
  alt: string;
}

const ClientsSection = () => {
  const { ref, inView } = useInView();
  const [logos, setLogos] = useState<LogoItem[]>(
    defaultLogos.map(l => ({ src: l.logo, alt: l.name }))
  );

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

  const looped = [...logos, ...logos];

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
          className="overflow-hidden"
          onMouseEnter={e => {
            const track = e.currentTarget.querySelector<HTMLDivElement>(".logos-track");
            if (track) track.style.animationPlayState = "paused";
          }}
          onMouseLeave={e => {
            const track = e.currentTarget.querySelector<HTMLDivElement>(".logos-track");
            if (track) track.style.animationPlayState = "running";
          }}
        >
          <div
            className="logos-track flex items-center w-max"
            style={{
              gap: "64px",
              animation: "scroll-logos 20s linear infinite",
            }}
          >
            {looped.map((logo, i) => (
              <img
                key={i}
                src={logo.src}
                alt={logo.alt}
                loading="lazy"
                className="flex-shrink-0 object-contain transition-opacity duration-200"
                style={{
                  height: "60px",
                  width: "auto",
                  opacity: 0.85,
                }}
                onMouseEnter={e => { (e.target as HTMLImageElement).style.opacity = "1"; }}
                onMouseLeave={e => { (e.target as HTMLImageElement).style.opacity = "0.85"; }}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ClientsSection;
