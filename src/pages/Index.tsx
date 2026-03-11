import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import BenefitsBar from "@/components/BenefitsBar";
import CategoriesSection from "@/components/CategoriesSection";
import BestSellersSection from "@/components/BestSellersSection";
import CatalogSection from "@/components/CatalogSection";
import ClientsSection from "@/components/ClientsSection";
import TestimonialsSection from "@/components/TestimonialsSection";
import HowItWorks from "@/components/HowItWorks";
import LeadCapture from "@/components/LeadCapture";
import Footer from "@/components/Footer";

const Index = () => (
  <div className="min-h-screen flex flex-col bg-background">
    <Header />
    <main className="flex-1">
      <HeroSection />
      <BenefitsBar />
      <CategoriesSection />
      <BestSellersSection />
      <CatalogSection />
      <ClientsSection />
      <TestimonialsSection />
      <HowItWorks />
      <LeadCapture />
    </main>
    <Footer />
  </div>
);

export default Index;
