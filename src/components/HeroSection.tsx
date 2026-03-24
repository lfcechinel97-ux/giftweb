import { useState, useEffect, useCallback, useRef, TouchEvent } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import heroBanner from "@/assets/hero-banner.jpg";
import { useBaseCategories } from "@/hooks/useBaseCategories";
import { useSiteContent } from "@/hooks/useSiteContent";

const swatchColors = [
  { bg: "#EF4444", name: "VERMELHO", values: ["VERMELHO"] },
  { bg: "#2563EB", name: "AZUL", values: ["AZUL"] },
  { bg: "#22C55E", name: "VERDE", values: ["VERDE"] },
  { bg: "#EAB308", name: "AMARELO", values: ["AMARELO"] },
  { bg: "#A855F7", name: "ROXO", values: ["ROXO"] },
  { bg: "#EC4899", name: "ROSA", values: ["ROSA"] },
  { bg: "#F97316", name: "LARANJA", values: ["LARANJA"] },
  { bg: "#1F2937", name: "PRETO", values: ["PRETO"] },
  { bg: "#FFFFFF", name: "BRANCO", values: ["BRANCO"] },
  { bg: "#6B7280", name: "CINZA", values: ["CINZA", "CHUMBO"] },
  { bg: "#92400E", name: "MARROM", values: ["MARROM"] },
  { bg: "#F59E0B", name: "DOURADO", values: ["DOURADO"] },
  { bg: "#9CA3AF", name: "PRATA / INOX", values: ["PRATA", "INOX", "COBRE"] },
  { bg: "#D2B48C", name: "BEGE", values: ["BEGE"] },
  { bg: "#CD7F32", name: "BRONZE", values: ["BRONZE"] },
  { bg: "#7F1D1D", name: "VINHO", values: ["VINHO"] },
  { bg: "#374151", name: "GRAFITE", values: ["GRAFITE"] },
  { bg: "#C4A35A", name: "OUTROS", values: ["KRAFT", "TRANSPARENTE", "COLORIDO", "BAMBU", "MADEIRA"] },
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
    const colorValues = selectedColor !== null ? swatchColors[selectedColor].values.join(",") : null;

    if (selectedCategory && q) {
      navigate(`/categoria/${selectedCategory}?q=${encodeURIComponent(q)}${colorValues ? `&cor=${encodeURIComponent(colorValues)}` : ""}`);
    } else if (selectedCategory) {
      navigate(`/categoria/${selectedCategory}${colorValues ? `?cor=${encodeURIComponent(colorValues)}` : ""}`);
    } else if (q) {
      navigate(`/busca?q=${encodeURIComponent(q)}${colorValues ? `&cor=${encodeURIComponent(colorValues)}` : ""}`);
    } else if (colorValues) {
      navigate(`/produtos?cor=${encodeURIComponent(colorValues)}`);
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
            <h1 className="font-black text-[24px] lg:text-[36px] leading-tight text-foreground">
              Explore nosso catálogo de<br />
              <span className="text-highlight">brindes:</span>
            </h1>
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
            <label className="text-sm font-medium text-muted-foreground mb-2 block">Cor</label>
            <div className="flex flex-wrap gap-2">
              {swatchColors.map((c, i) => {
                const isWhite = c.bg === "#FFFFFF";
                const isOutros = c.name === "OUTROS";
                return (
                  <div key={i} className="relative">
                    <button
                      onClick={() => setSelectedColor(i === selectedColor ? null : i)}
                      onMouseEnter={() => setHoveredColor(i)}
                      onMouseLeave={() => setHoveredColor(null)}
                      aria-label={`Filtrar por cor ${c.name}`}
                      className="w-10 h-10 rounded-full border-2 transition-all duration-200 flex items-center justify-center"
                      style={{
                        background: isOutros
                          ? "conic-gradient(#EF4444, #EAB308, #22C55E, #2563EB, #A855F7, #EC4899, #EF4444)"
                          : c.bg,
                        borderColor: selectedColor === i
                          ? "hsl(142,71%,45%)"
                          : isWhite
                            ? "#D1D5DB"
                            : "hsl(220,13%,91%)",
                        boxShadow: selectedColor === i ? "0 0 0 3px rgba(34,197,94,0.25)" : "none",
                        transform: selectedColor === i ? "scale(1.1)" : "scale(1)",
                      }}
                    >
                      {isOutros && <span className="text-white font-bold text-sm drop-shadow-md">+</span>}
                    </button>
                    {hoveredColor === i && (
                      <div className="absolute -top-9 left-1/2 -translate-x-1/2 bg-card border border-border rounded-md px-2 py-1 text-xs text-foreground whitespace-nowrap z-30 pointer-events-none shadow-sm">
                        {c.name}
                      </div>
                    )}
                  </div>
                );
              })}
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
                <img src={bannerSrc} alt="Brindes corporativos personalizados" className="absolute inset-0 w-full h-full object-cover" width={800} height={400} loading={i === 0 ? "eager" : "lazy"} />
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
