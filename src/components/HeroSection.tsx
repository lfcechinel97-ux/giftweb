import { useState, useEffect, useCallback } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import heroBanner from "@/assets/hero-banner.jpg";

const categories = ["Copos", "Garrafas", "Mochilas", "Bolsas", "Escritório", "Kit Corporativo"];

const swatchColors = [
  "bg-red-500", "bg-blue-600", "bg-green-500", "bg-yellow-400",
  "bg-purple-500", "bg-pink-500", "bg-orange-500", "bg-gray-800",
  "bg-cyan-400", "bg-rose-400", "bg-indigo-500", "bg-teal-500",
];

const slides = [
  { hashtag: "#SuaMarcaEm", highlight: "Evidência" },
  { hashtag: "Brindes que as pessoas guardam — e", highlight: "lembram" },
  { hashtag: "Do conceito à entrega, sua marca em cada", highlight: "detalhe" },
];

const HeroSection = () => {
  const [priceMin, setPriceMin] = useState(0);
  const [priceMax, setPriceMax] = useState(250);
  const [selectedColor, setSelectedColor] = useState<number | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  }, []);

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  }, []);

  useEffect(() => {
    const interval = setInterval(nextSlide, 4000);
    return () => clearInterval(interval);
  }, [nextSlide]);

  return (
    <section className="bg-background py-8">
      <div className="container flex flex-col lg:flex-row" style={{ minHeight: 540 }}>
        {/* Filter panel — 36% */}
        <div
          className="lg:w-[36%] bg-card rounded-[16px] p-10 flex flex-col gap-5 shrink-0"
          style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.12)" }}
        >
          <h2 className="font-black text-[38px] leading-tight text-navy">
            Encontre o brinde certo para a sua{" "}
            <br />
            <span className="text-highlight">marca</span>
          </h2>

          {/* Category dropdown */}
          <div className="relative">
            <select className="w-full appearance-none rounded-[10px] border border-border bg-background py-3 pl-4 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-green-cta/40">
              <option>Escolha a categoria de brinde</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-meta pointer-events-none" />
          </div>

          {/* Price range */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">
                A partir de: <strong className="text-green-cta">R$ {priceMin},00</strong>
              </span>
              <span className="text-muted-foreground">
                Valor máximo: <strong className="text-green-cta">R$ {priceMax},00</strong>
              </span>
            </div>
            <div className="flex gap-3">
              <input
                type="range"
                min={0}
                max={500}
                value={priceMin}
                onChange={(e) => setPriceMin(Math.min(Number(e.target.value), priceMax))}
                className="w-full accent-green-cta"
              />
              <input
                type="range"
                min={0}
                max={500}
                value={priceMax}
                onChange={(e) => setPriceMax(Math.max(Number(e.target.value), priceMin))}
                className="w-full accent-green-cta"
              />
            </div>
          </div>

          {/* Color swatches — 12 */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">Cor</label>
            <div className="flex flex-wrap gap-2">
              {swatchColors.map((c, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedColor(i === selectedColor ? null : i)}
                  className={`w-10 h-10 rounded-full ${c} border-2 transition-all duration-200 ${
                    selectedColor === i
                      ? "border-green-cta scale-110 ring-2 ring-green-cta/40"
                      : "border-transparent hover:scale-105"
                  }`}
                />
              ))}
            </div>
          </div>

          <button
            className="mt-auto flex items-center justify-center gap-2 rounded-[10px] bg-navy px-4 font-bold uppercase text-primary-foreground hover:bg-navy-hover transition-colors duration-200"
            style={{ height: 52, fontSize: 15 }}
          >
            BUSCAR BRINDE
          </button>
        </div>

        {/* Carousel — 64% */}
        <div className="lg:w-[64%] relative rounded-[16px] overflow-hidden flex items-center mt-6 lg:mt-0" style={{ minHeight: 540 }}>
          {/* Slides */}
          {slides.map((slide, i) => (
            <div
              key={i}
              className={`absolute inset-0 transition-opacity duration-600 ${
                i === currentSlide ? "opacity-100 hero-slide-active" : "opacity-0 pointer-events-none"
              }`}
            >
              <img
                src={heroBanner}
                alt="Brindes corporativos personalizados"
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div
                className="absolute inset-0"
                style={{ background: "linear-gradient(135deg, hsla(217,75%,15%,0.85) 0%, hsla(217,75%,15%,0.5) 100%)" }}
              />
              <div className="relative z-10 flex items-center h-full p-8 md:p-14">
                <h2 className="text-primary-foreground font-black text-[36px] md:text-[52px] leading-tight max-w-xl">
                  {slide.hashtag}{" "}
                  <span className="text-highlight">{slide.highlight}</span>
                </h2>
              </div>
            </div>
          ))}

          {/* Arrows */}
          <button
            onClick={prevSlide}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-primary-foreground transition-colors duration-200"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            onClick={nextSlide}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center text-primary-foreground transition-colors duration-200"
          >
            <ChevronRight size={22} />
          </button>

          {/* Dots */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentSlide(i)}
                className={`w-3 h-3 rounded-full transition-all duration-200 ${
                  i === currentSlide ? "bg-green-cta w-6" : "bg-white/50 hover:bg-white/70"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
