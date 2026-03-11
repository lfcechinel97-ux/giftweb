import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import BenefitsBar from "@/components/BenefitsBar";
import CategoriesSection from "@/components/CategoriesSection";
import ProductsSection from "@/components/ProductsSection";
import HowItWorks from "@/components/HowItWorks";
import LeadCapture from "@/components/LeadCapture";
import Footer from "@/components/Footer";

const Index = () => (
  <div className="min-h-screen flex flex-col">
    <Header />
    <main className="flex-1">
      <HeroSection />
      <BenefitsBar />
      <CategoriesSection />
      <ProductsSection title="Lançamentos" badge="Lançamento" />
      <ProductsSection title="Mais Vendidos" />
      <ProductsSection title="Destaques" />
      <HowItWorks />
      <LeadCapture />
    </main>
    <Footer />
  </div>
);

export default Index;
