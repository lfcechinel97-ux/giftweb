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

const ClientsSection = () => {
  const [logos, setLogos] = useState(defaultLogos);
  const [index, setIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const VISIBLE = isMobile ? 3 : 5;
  const { ref: sectionRef, inView } = useInView(0.1);

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
    const interval = setInterval(() => {
      if (!trackRef.current || !containerRef.current) return;
      const totalWidth = containerRef.current.offsetWidth;
      const singleItem = totalWidth / VISIBLE;

      trackRef.current.style.transition = 'transform 600ms cubic-bezier(0.25, 0.1, 0.25, 1)';
      trackRef.current.style.transform = `translateX(-${singleItem}px)`;

      setTimeout(() => {
        setIndex(prev => (prev + 1) % logos.length);
        if (trackRef.current) {
          trackRef.current.style.transition = 'none';
          trackRef.current.style.transform = 'translateX(0)';
        }
      }, 620);
    }, 3000);

    return () => clearInterval(interval);
  }, [logos.length, VISIBLE]);

  const visible = Array.from({ length: VISIBLE + 1 }, (_, i) =>
    logos[(index + i) % logos.length]
  );

  const itemWidth = `${100 / VISIBLE}%`;

  return (
    <section
      ref={sectionRef}
      className={`py-12 md:py-14 bg-card border-t border-border transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
    >
      <div className="text-center mb-8 px-4">
        <h2 className="text-foreground font-extrabold text-[22px] md:text-[26px] mb-1.5">
          Grandes clientes que confiam na{' '}
          <em className="not-italic text-primary">Gift Web</em>
        </h2>
        <p className="text-muted-foreground text-sm">
          Marcas que escolheram qualidade e personalização
        </p>
      </div>

      <div
        ref={containerRef}
        style={{
          maxWidth: '1100px',
          width: '100%',
          margin: '0 auto',
          padding: '0 24px',
          overflow: 'hidden',
          boxSizing: 'border-box' as const,
        }}
      >
        <div
          ref={trackRef}
          style={{
            display: 'flex',
            flexDirection: 'row' as const,
            transform: 'translateX(0)',
            willChange: 'transform',
          }}
        >
          {visible.map((logo, i) => (
            <div
              key={i}
              style={{
                flexShrink: 0,
                width: itemWidth,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '0 12px',
                boxSizing: 'border-box' as const,
              }}
            >
              {logo?.value && (
                <img
                  src={logo.value}
                  width={160}
                  height={80}
                  alt="Logo de cliente parceiro"
                  loading="lazy"
                  style={{
                    height: '80px',
                    width: '100%',
                    objectFit: 'contain' as const,
                    display: 'block',
                    filter: 'grayscale(100%) opacity(0.55)',
                    transition: 'filter 0.3s ease',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLImageElement).style.filter = 'grayscale(0%) opacity(1)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLImageElement).style.filter = 'grayscale(100%) opacity(0.55)';
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ClientsSection;
