import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import BenefitsBar from "@/components/BenefitsBar";
import CategoriesSection from "@/components/CategoriesSection";
import ProductsSection from "@/components/ProductsSection";
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
      <section className="bg-background">
        <ProductsSection title="Lançamentos" badge="Lançamento" />
      </section>
      <section className="bg-surface-alt">
        <ProductsSection title="Mais Vendidos" />
      </section>
      <section className="bg-background">
        <ProductsSection title="Destaques" />
      </section>
      <HowItWorks />
      <LeadCapture />
    </main>
    <Footer />
  </div>
);

export default Index;
