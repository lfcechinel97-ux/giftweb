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
      style={{ padding: '48px 0', background: '#F8F9FA' }}
      className={`transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
    >
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: '700', margin: '0 0 6px', color: '#111827' }}>
          Grandes clientes que confiam na{' '}
          <em style={{ fontStyle: 'italic', color: '#22C55E' }}>Gift Web</em>
        </h2>
        <p style={{ color: '#6B7280', fontSize: '14px', margin: 0 }}>
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
                  alt={`Cliente ${i + 1}`}
                  className="client-logo"
                  style={{
                    height: '90px',
                    width: '100%',
                    objectFit: 'contain' as const,
                    display: 'block',
                    filter: 'grayscale(100%) opacity(0.65)',
                    transition: 'filter 0.35s ease',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLImageElement).style.filter = 'grayscale(0%) opacity(1)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLImageElement).style.filter = 'grayscale(100%) opacity(0.65)';
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
