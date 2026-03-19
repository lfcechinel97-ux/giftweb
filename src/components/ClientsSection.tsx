import { useEffect, useRef, useState } from "react";
import { useInView } from "@/hooks/useInView";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";

const defaultLogos = [
  { value: "/logos/petrobras.png" },
  { value: "/logos/ambev.png" },
  { value: "/logos/natura.png" },
  { value: "/logos/itau.png" },
  { value: "/logos/bradesco.png" },
  { value: "/logos/vale.png" },
  { value: "/logos/embraer.png" },
  { value: "/logos/gerdau.png" },
  { value: "/logos/vivo.png" },
  { value: "/logos/tim.png" },
  { value: "/logos/globo.png" },
  { value: "/logos/weg.png" },
];

const INTERVAL = 2500;
const SLIDE_DURATION = 500;

const ClientsSection = () => {
  const { ref, inView } = useInView();
  const isMobile = useIsMobile();
  const VISIBLE = isMobile ? 3 : 5;

  const [logos, setLogos] = useState(defaultLogos);
  const [index, setIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

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
          .map(r => ({ value: r.value! }));
        if (dbLogos.length > 0) setLogos(dbLogos);
      });
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      if (trackRef.current) {
        trackRef.current.style.transition = `transform ${SLIDE_DURATION}ms ease`;
        trackRef.current.style.transform = "translateX(-100%)";
      }
      setTimeout(() => {
        setIndex(prev => (prev + 1) % logos.length);
        if (trackRef.current) {
          trackRef.current.style.transition = "none";
          trackRef.current.style.transform = "translateX(0)";
        }
      }, SLIDE_DURATION);
    }, INTERVAL);
    return () => clearInterval(t);
  }, [logos.length]);

  const visible = Array.from({ length: VISIBLE + 1 }, (_, i) =>
    logos[(index + i) % logos.length]
  );

  return (
    <section className="py-8 bg-background border-t border-border">
      <div
        ref={ref}
        className={`transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`}
      >
        <h2 className="text-center text-foreground font-extrabold text-[32px] mb-2">
          Grandes clientes que confiam na{" "}
          <span className="text-highlight">Gift Web</span>
        </h2>
        <p className="text-center text-muted-foreground mb-6">
          Marcas que escolheram qualidade e personalização
        </p>

        <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "0 24px", overflow: "hidden" }}>
          <div
            ref={trackRef}
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${VISIBLE + 1}, calc(100% / ${VISIBLE}))`,
              gap: "0",
              alignItems: "center",
              transform: "translateX(0)",
            }}
          >
            {visible.map((logo, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  padding: "0 16px",
                }}
              >
                {logo?.value && (
                  <img
                    src={logo.value}
                    alt={`Cliente ${i + 1}`}
                    style={{
                      height: "80px",
                      width: "100%",
                      maxWidth: "180px",
                      objectFit: "contain",
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ClientsSection;
