import { useState, useEffect, useCallback, useRef, TouchEvent } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import heroBanner from "@/assets/hero-banner.jpg";
import { useBaseCategories } from "@/hooks/useBaseCategories";
import { useSiteContent } from "@/hooks/useSiteContent";

const swatchColors = [
  { bg: "#EF4444", name: "Vermelho" },
  { bg: "#2563EB", name: "Azul" },
  { bg: "#22C55E", name: "Verde" },
  { bg: "#EAB308", name: "Amarelo" },
  { bg: "#A855F7", name: "Roxo" },
  { bg: "#EC4899", name: "Rosa" },
  { bg: "#F97316", name: "Laranja" },
  { bg: "#1F2937", name: "Preto" },
  { bg: "#06B6D4", name: "Ciano" },
  { bg: "#FB7185", name: "Rose" },
  { bg: "#6366F1", name: "Índigo" },
  { bg: "#14B8A6", name: "Teal" },
];

const slides = [
  { text: "Sua marca presente em cada", highlight: "momento" },
  { text: "Brindes que criam", highlight: "conexões reais" },
  { text: "Do conceito à entrega, com", highlight: "excelência" },
];

const HeroSection = () => {
  const { data: categories, isLoading: categoriesLoading } = useBaseCategories();
  const { rows: bannerRows } = useSiteContent('banners');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  const [priceMin, setPriceMin] = useState(0);
  const [priceMax, setPriceMax] = useState(250);
  const [selectedColor, setSelectedColor] = useState<number | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [hoveredColor, setHoveredColor] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [searchText, setSearchText] = useState("");
  const touchStart = useRef(0);
  const navigate = useNavigate();

  const nextSlide = useCallback(() => setCurrentSlide((prev) => (prev + 1) % slides.length), []);
  const prevSlide = useCallback(() => setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length), []);

  useEffect(() => {
    const interval = setInterval(nextSlide, 7000);
    return () => clearInterval(interval);
  }, [nextSlide]);

  const onTouchStart = (e: TouchEvent) => { touchStart.current = e.touches[0].clientX; };
  const onTouchEnd = (e: TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStart.current;
    if (Math.abs(dx) > 50) { if (dx > 0) prevSlide(); else nextSlide(); }
  };

  const handleSearch = () => {
    const q = searchText.trim();
    const colorName = selectedColor !== null ? swatchColors[selectedColor].name : null;

    if (selectedCategory && q) {
      navigate(`/categoria/${selectedCategory}?q=${encodeURIComponent(q)}${colorName ? `&cor=${encodeURIComponent(colorName)}` : ""}`);
    } else if (selectedCategory) {
      navigate(`/categoria/${selectedCategory}${colorName ? `?cor=${encodeURIComponent(colorName)}` : ""}`);
    } else if (q) {
      navigate(`/busca?q=${encodeURIComponent(q)}`);
    } else if (colorName) {
      navigate(`/produtos?cor=${encodeURIComponent(colorName)}`);
    } else {
      navigate("/produtos");
    }
  };

  return (
    <section className="py-8 md:py-10 relative overflow-hidden bg-background">
      <div className="container flex flex-col lg:flex-row relative z-10 gap-5" style={{ minHeight: 270 }}>
        {/* Filter panel */}
        <div className="lg:w-[36%] bg-card rounded-2xl border border-border px-4 py-5 lg:p-10 flex flex-col gap-4 lg:gap-5 shrink-0" style={{ boxShadow: "0 2px 20px rgba(0,0,0,0.07)" }}>
          <div>
            <h2 className="font-black text-[24px] lg:text-[36px] leading-tight text-foreground">
              Explore nosso catálogo de<br />
              <span className="text-highlight">brindes:</span>
            </h2>
            <p className="text-muted-foreground text-xs mt-1.5 hidden lg:block">Filtre por categoria, preço e cor</p>
          </div>

          <div className="relative">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full appearance-none rounded-xl border border-border bg-card py-2.5 pl-4 pr-10 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors duration-200"
            >
              <option value="">Escolha a categoria de brinde</option>
              {categoriesLoading && <option disabled>Carregando...</option>}
              {categories?.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-green-cta pointer-events-none" />
          </div>

          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">A partir de: <strong className="text-green-cta">R$ {priceMin},00</strong></span>
              <span className="text-muted-foreground">Valor máximo: <strong className="text-green-cta">R$ {priceMax},00</strong></span>
            </div>
            <div className="flex gap-3">
              <input type="range" min={0} max={500} value={priceMin} onChange={(e) => setPriceMin(Math.min(Number(e.target.value), priceMax))} className="w-full" />
              <input type="range" min={0} max={500} value={priceMax} onChange={(e) => setPriceMax(Math.max(Number(e.target.value), priceMin))} className="w-full" />
            </div>
            <div className="flex gap-2 mt-2">
              <input type="text" inputMode="numeric" value={priceMin} onChange={(e) => { const v = Number(e.target.value.replace(/\D/g, "")); if (!isNaN(v)) setPriceMin(Math.min(v, priceMax)); }} className="w-full rounded-xl border border-border bg-card py-2 px-3 text-sm font-bold text-primary text-center focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors duration-200" />
              <input type="text" inputMode="numeric" value={priceMax} onChange={(e) => { const v = Number(e.target.value.replace(/\D/g, "")); if (!isNaN(v)) setPriceMax(Math.max(v, priceMin)); }} className="w-full rounded-xl border border-border bg-card py-2 px-3 text-sm font-bold text-primary text-center focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors duration-200" />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">Cor</label>
            <div className="flex flex-wrap gap-2">
              {swatchColors.map((c, i) => (
                <div key={i} className="relative">
                  <button
                    onClick={() => setSelectedColor(i === selectedColor ? null : i)}
                    onMouseEnter={() => setHoveredColor(i)}
                    onMouseLeave={() => setHoveredColor(null)}
                    className="w-10 h-10 rounded-full border-2 transition-all duration-200"
                    style={{
                      backgroundColor: c.bg,
                      borderColor: selectedColor === i ? "hsl(142,71%,45%)" : "hsl(220,13%,91%)",
                      boxShadow: selectedColor === i ? "0 0 0 3px rgba(34,197,94,0.25)" : "none",
                      transform: selectedColor === i ? "scale(1.1)" : "scale(1)",
                    }}
                  />
                  {hoveredColor === i && (
                    <div className="absolute -top-9 left-1/2 -translate-x-1/2 bg-card border border-border rounded-md px-2 py-1 text-xs text-foreground whitespace-nowrap z-30 pointer-events-none shadow-sm">
                      {c.name}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleSearch}
            className="mt-auto flex items-center justify-center gap-2 rounded-xl bg-primary px-4 font-bold uppercase text-primary-foreground transition-all duration-200 hover:brightness-110 active:scale-[0.97]"
            style={{ height: 50, fontSize: 14, letterSpacing: "0.5px", boxShadow: "0 0 20px rgba(34,197,94,0.18)" }}
            onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 0 28px rgba(34,197,94,0.38)")}
            onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "0 0 20px rgba(34,197,94,0.18)")}
          >
            BUSCAR BRINDE
          </button>
        </div>

        {/* Carousel */}
        <div className="lg:w-[64%] relative rounded-2xl overflow-hidden flex items-center mt-5 lg:mt-0 border border-border" style={{ minHeight: 270 }} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          {slides.map((slide, i) => {
            const deskRow = bannerRows.find(r => r.id === `banner_${i + 1}_desk`);
            const mobRow = bannerRows.find(r => r.id === `banner_${i + 1}_mob`);
            const bannerSrc = (isMobile && mobRow?.value) ? mobRow.value : (deskRow?.value || heroBanner);

            return (
              <div key={i} className="absolute inset-0" style={{ opacity: i === currentSlide ? 1 : 0, transform: i === currentSlide ? "scale(1)" : "scale(1.03)", transition: "opacity 1.2s ease-in-out, transform 1.4s ease-in-out", pointerEvents: i === currentSlide ? "auto" : "none" }}>
                <img src={bannerSrc} alt="Brindes corporativos personalizados" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(11,15,26,0.85) 0%, rgba(11,15,26,0.3) 100%)" }} />
                <div className="relative z-10 flex items-center h-full p-8 md:p-14">
                  <h2 className="text-white font-black text-[36px] md:text-[52px] leading-tight max-w-xl" style={{ opacity: i === currentSlide ? 1 : 0, transform: i === currentSlide ? "translateY(0)" : "translateY(20px)", transition: "opacity 0.8s ease-out 0.4s, transform 0.8s ease-out 0.4s" }}>
                    {slide.text} <span className="text-highlight">{slide.highlight}</span>
                  </h2>
                </div>
              </div>
            );
          })}

          <button onClick={prevSlide} className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-white transition-all duration-200 hover:bg-green-cta hover:border-green-cta" style={{ background: "rgba(255,255,255,0.08)" }}>
            <ChevronLeft size={22} />
          </button>
          <button onClick={nextSlide} className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-white transition-all duration-200 hover:bg-green-cta hover:border-green-cta" style={{ background: "rgba(255,255,255,0.08)" }}>
            <ChevronRight size={22} />
          </button>

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2">
            {slides.map((_, i) => (
              <button key={i} onClick={() => setCurrentSlide(i)} className={`w-3 h-3 rounded-full transition-all duration-300 ${i === currentSlide ? "bg-green-cta w-6" : "bg-white/40 hover:bg-white/60"}`} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
