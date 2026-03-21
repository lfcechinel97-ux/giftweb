import { useEffect, useState } from "react";
import { useInView } from "@/hooks/useInView";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

interface ShowcaseItem {
  id: number;
  position: number;
  title: string | null;
  price_text: string | null;
  image_url: string | null;
  link_url: string | null;
  badge_text: string | null;
  is_active: boolean;
}

function useShowcaseItems() {
  const isMobile = useIsMobile();
  const [items, setItems] = useState<ShowcaseItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("homepage_featured_showcase")
      .select("*")
      .eq("is_active", true)
      .order("position", { ascending: true })
      .limit(isMobile ? 6 : 8)
      .then(({ data }) => {
        setItems((data as ShowcaseItem[]) || []);
        setLoading(false);
      });
  }, [isMobile]);

  return { items, loading };
}

const ShowcaseCard = ({ item }: { item: ShowcaseItem }) => {
  const Wrapper = item.link_url ? "a" : "div";
  const wrapperProps = item.link_url
    ? { href: item.link_url, style: { textDecoration: "none" } as React.CSSProperties }
    : {};

  return (
    <Wrapper
      {...wrapperProps}
      className="relative rounded-2xl bg-card border border-border p-3 transition-all duration-250 group hover:-translate-y-1 cursor-pointer block"
      style={{
        boxShadow: "0 1px 4px hsl(200 57% 27% / 0.04)",
        transition: "box-shadow 0.25s ease, transform 0.25s ease, border-color 0.25s ease"
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.boxShadow = "0 8px 28px hsl(200 57% 27% / 0.09)";
        el.style.borderColor = "hsl(82 84% 55% / 0.35)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.boxShadow = "0 1px 4px rgba(0,0,0,0.04)";
        el.style.borderColor = "hsl(var(--border))";
      }}
    >
      {item.badge_text && (
        <div
          className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1 rounded-full px-2.5 py-1 text-white uppercase tracking-wide"
          style={{
            background: "linear-gradient(135deg, hsl(142 71% 35%), hsl(142 71% 45%))",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.5px",
            boxShadow: "0 2px 8px rgba(34,197,94,0.28)",
          }}
        >
          🥇 {item.badge_text}
        </div>
      )}

      <div
        className="aspect-square rounded-xl overflow-hidden mb-3"
        style={{ background: "hsl(var(--muted))" }}
      >
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.title || "Produto"}
            loading="lazy"
            className="w-full h-full object-contain p-2 transition-transform duration-300 group-hover:scale-[1.04]"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/placeholder-product.webp";
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-muted-foreground text-sm">Sem imagem</span>
          </div>
        )}
      </div>

      {item.title && (
        <h4 className="text-foreground uppercase leading-tight line-clamp-2 mb-1.5" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.3px" }}>
          {item.title}
        </h4>
      )}

      {item.price_text && (
        <p className="text-primary font-bold" style={{ fontSize: 15 }}>
          {item.price_text}
        </p>
      )}
    </Wrapper>
  );
};

const BestSellersSection = () => {
  const { ref, inView } = useInView();
  const { items, loading } = useShowcaseItems();

  return (
    <section className="py-10 md:py-14 bg-secondary/30">
      <div
        ref={ref}
        className={`container transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`}
      >
        <div className="mb-7">
          <h2 className="text-foreground font-extrabold text-[28px] md:text-[32px] leading-tight">
            Brindes mais <span className="text-highlight">procurados</span> pelas empresas
          </h2>
          <p className="text-muted-foreground text-sm mt-1.5">Seleção curada dos produtos favoritos dos nossos clientes</p>
        </div>

        {!loading && items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <p className="text-muted-foreground text-sm">
              📦 Nenhum produto em destaque ainda. Configure no painel admin → Vitrine.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {loading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="rounded-2xl bg-card border border-border p-3">
                    <Skeleton className="aspect-square rounded-xl w-full mb-3" />
                    <Skeleton className="h-3 w-3/4 mb-1.5" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ))
              : items.map((item) => <ShowcaseCard key={item.id} item={item} />)}
          </div>
        )}
      </div>
    </section>
  );
};

export default BestSellersSection;
