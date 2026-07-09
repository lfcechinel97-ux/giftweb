import { useState, useEffect } from "react";
import { useSiteContentContext } from "@/contexts/SiteContentContext";
import bannerB2B from "@/assets/banner-b2b.webp";
import { buildVersionedCmsUrl, getVersionedRowValue } from "@/utils/siteContentImage";

const BannerSeparator = () => {
  const { getBySection } = useSiteContentContext();
  const rows = getBySection("banners");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  const deskRow = rows.find((r) => r.id === "banner_marca_desk");
  const mobRow = rows.find((r) => r.id === "banner_marca_mob");
  const linkRow = rows.find((r) => r.id === "banner_marca_link");
  const fallbackSrc = buildVersionedCmsUrl(bannerB2B, "local-banner", "local-banner") || bannerB2B;
  const deskSrc = getVersionedRowValue(deskRow, "marca-desk") || fallbackSrc;
  const mobSrc = getVersionedRowValue(mobRow, "marca-mob") || deskSrc;
  const src = isMobile ? mobSrc : deskSrc;
  const link = (linkRow?.value || "").trim() || null;
  const isExternal = !!link && /^https?:\/\//i.test(link);

  const img = (
    <img
      src={src}
      alt="Brindes que fortalecem sua marca — Gift Web"
      loading="lazy"
      width={1200}
      height={300}
      className="block h-auto w-full object-cover object-center"
    />
  );

  return (
    <div className="mx-3 overflow-hidden rounded-xl border border-border bg-card md:mx-8">
      {link ? (
        <a
          href={link}
          target={isExternal ? "_blank" : undefined}
          rel={isExternal ? "noopener noreferrer" : undefined}
          className="block"
        >
          {img}
        </a>
      ) : (
        img
      )}
    </div>
  );
};

export default BannerSeparator;
