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
      className="relative rounded-2xl bg-white border border-[#E5E7EB] p-3 transition-all duration-200 group hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] cursor-pointer block"
    >
      {item.badge_text && (
        <div
          className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1 rounded-full px-2.5 py-1 text-white uppercase tracking-wide"
          style={{
            background: "linear-gradient(135deg, #16A34A, #22C55E)",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.5px",
            boxShadow: "0 2px 8px rgba(34,197,94,0.35)",
          }}
        >
          🥇 {item.badge_text}
        </div>
      )}

      <div
        className="aspect-square rounded-xl overflow-hidden mb-3"
        style={{ background: "#F9FAFB" }}
      >
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.title || "Produto"}
            loading="lazy"
            className="w-full h-full object-contain p-2"
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
        <h4
          className="uppercase leading-tight line-clamp-2 mb-1"
          style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}
        >
          {item.title}
        </h4>
      )}

      {item.price_text && (
        <p style={{ fontSize: 15, fontWeight: 700, color: "#22C55E" }}>
          {item.price_text}
        </p>
      )}
    </Wrapper>
  );
};

const BestSellersSection = () => {
  const { ref, inView } = useInView();
  const { items, loading } = useShowcaseItems();

  if (!loading && items.length === 0) return null;

  return (
    <section className="py-10 md:py-12 bg-surface-alt">
      <div
        ref={ref}
        className={`container transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`}
      >
        <h2 className="text-foreground font-extrabold text-[32px] mb-6">
          Brindes mais <span className="text-highlight">procurados</span> pelas empresas
        </h2>

        <div
          className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4"
        >
          {loading
            ? Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="rounded-2xl bg-white border border-[#E5E7EB] p-3">
                  <Skeleton className="aspect-square rounded-xl w-full mb-3" />
                  <Skeleton className="h-3 w-3/4 mb-1" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))
            : items.map((item) => <ShowcaseCard key={item.id} item={item} />)}
        </div>
      </div>
    </section>
  );
};

export default BestSellersSection;
