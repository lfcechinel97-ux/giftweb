import { useState, useEffect } from "react";
import { useSiteContent } from "@/hooks/useSiteContent";
import bannerB2B from "@/assets/banner-b2b.jpg";

const BannerSeparator = () => {
  const { rows } = useSiteContent("banners");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const deskRow = rows.find((r) => r.id === "banner_marca_desk");
  const mobRow = rows.find((r) => r.id === "banner_marca_mob");
  const src = (isMobile && mobRow?.value) ? mobRow.value : (deskRow?.value || bannerB2B);

  return (
    <div className="mx-4 md:mx-8 rounded-2xl overflow-hidden">
      <img
        src={src}
        alt="Brindes que fortalecem sua marca — Gift Web"
        className="w-full h-auto block md:object-contain md:object-center"
      />
    </div>
  );
};

export default BannerSeparator;
