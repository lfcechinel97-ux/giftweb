import { Helmet } from "react-helmet-async";
import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import BenefitsBar from "@/components/BenefitsBar";
import CategoriesSection from "@/components/CategoriesSection";
import BestSellersSection from "@/components/BestSellersSection";
import BannerSeparator from "@/components/BannerSeparator";
import CatalogSection from "@/components/CatalogSection";
import ClientsSection from "@/components/ClientsSection";
import TestimonialsSection from "@/components/TestimonialsSection";
import HowItWorks from "@/components/HowItWorks";
import TrustSection from "@/components/TrustSection";
import Footer from "@/components/Footer";
import FloatingWhatsApp from "@/components/FloatingWhatsApp";
import CorporateQuotation from "@/components/CorporateQuotation";
import SeoTextSection from "@/components/SeoTextSection";
import FAQSection from "@/components/FAQSection";

import { useHomepageData } from "@/hooks/useHomepageData";
import { SITE_URL } from "@/config/site";

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Gift Web Brindes",
  url: SITE_URL,
  logo: `${SITE_URL}/logos/giftweb-logo.png`,
  contactPoint: [
    { "@type": "ContactPoint", telephone: "+55-48-99665-2844", contactType: "sales", areaServed: "BR" },
    { "@type": "ContactPoint", telephone: "+55-11-97016-9697", contactType: "sales", areaServed: "BR" },
  ],
  sameAs: ["https://instagram.com/giftweboficial"],
};

const localBusinessSchema = [
  {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "Gift Web Brindes – Matriz SC",
    address: { "@type": "PostalAddress", streetAddress: "Rua Cel Marcos Rovaris, 274 – Centro", addressLocality: "Içara", addressRegion: "SC", addressCountry: "BR" },
    telephone: "+55-48-99665-2844",
    url: SITE_URL,
  },
  {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "Gift Web Brindes – Filial SP",
    address: { "@type": "PostalAddress", streetAddress: "Av. Monteiro Lobato, 4550 – Galpão 6 – Setor 7 – Cidade Jardim Cumbica", addressLocality: "Guarulhos", addressRegion: "SP", addressCountry: "BR" },
    telephone: "+55-11-97016-9697",
    url: SITE_URL,
  },
];

const Index = () => {
  const { data } = useHomepageData();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Helmet>
        <title>Gift Web Brindes | Brindes Corporativos Personalizados para Empresas</title>
        <meta name="description" content="Gift Web Brindes: mais de 3.000 brindes corporativos personalizados para empresas. Garrafas, copos, mochilas, kits e muito mais. Solicite seu orçamento!" />
        <link rel="canonical" href={SITE_URL} />
        <meta property="og:title" content="Gift Web Brindes | Brindes Corporativos Personalizados" />
        <meta property="og:description" content="Mais de 3.000 brindes corporativos personalizados para empresas. Garrafas, copos, mochilas, kits e muito mais." />
        <meta property="og:url" content={SITE_URL} />
        <script type="application/ld+json">{JSON.stringify(organizationSchema)}</script>
        {localBusinessSchema.map((s, i) => (
          <script key={i} type="application/ld+json">{JSON.stringify(s)}</script>
        ))}
      </Helmet>
      <Header />
      <main className="flex-1">
        <HeroSection />
        <BenefitsBar />
        <CorporateQuotation />
        <CategoriesSection categoryCounts={data?.categorias || {}} />
        <BestSellersSection />
        <BannerSeparator />
        <CatalogSection />
        <ClientsSection />
        <TestimonialsSection />
        <HowItWorks />
        <TrustSection />
        <FAQSection />
        <SeoTextSection />
      </main>
      <Footer />
      <FloatingWhatsApp />
    </div>
  );
};

export default Index;
