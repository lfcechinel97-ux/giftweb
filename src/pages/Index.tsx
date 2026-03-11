import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import BenefitsBar from "@/components/BenefitsBar";
import CategoriesSection from "@/components/CategoriesSection";
import BestSellersSection from "@/components/BestSellersSection";
import LaunchSection from "@/components/LaunchSection";
import BannerSeparator from "@/components/BannerSeparator";
import CatalogSection from "@/components/CatalogSection";
import ClientsSection from "@/components/ClientsSection";
import TestimonialsSection from "@/components/TestimonialsSection";
import HowItWorks from "@/components/HowItWorks";
import TrustSection from "@/components/TrustSection";
import Footer from "@/components/Footer";
import FloatingWhatsApp from "@/components/FloatingWhatsApp";
import CorporateQuotation from "@/components/CorporateQuotation";
import LeadCapture from "@/components/LeadCapture";
import SeoTextSection from "@/components/SeoTextSection";
import { useHomepageData } from "@/hooks/useHomepageData";

const Index = () => {
  const { data, isLoading } = useHomepageData();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <HeroSection />
        <BenefitsBar />
        <CorporateQuotation />
        <CategoriesSection categoryCounts={data?.categorias || {}} />
        <LaunchSection products={data?.lancamentos || []} loading={isLoading} />
        <BestSellersSection products={data?.maisVendidos || []} loading={isLoading} />
        <BannerSeparator />
        <CatalogSection />
        <ClientsSection />
        <TestimonialsSection />
        <HowItWorks />
        <LeadCapture />
        <TrustSection />
        <SeoTextSection />
      </main>
      <Footer />
      <FloatingWhatsApp />
    </div>
  );
};

export default Index;
