import { useState } from "react";
import { Search, ChevronDown } from "lucide-react";
import heroBanner from "@/assets/hero-banner.jpg";

const categories = ["Copos", "Garrafas", "Mochilas", "Bolsas", "Escritório", "Kit Corporativo"];
const swatchColors = [
  "bg-red-500", "bg-blue-500", "bg-green-500", "bg-yellow-400",
  "bg-purple-500", "bg-pink-500", "bg-orange-500", "bg-gray-800",
  "bg-cyan-400", "bg-rose-400",
];

const HeroSection = () => {
  const [price, setPrice] = useState(250);
  const [selectedColor, setSelectedColor] = useState<number | null>(null);

  return (
    <section className="bg-background py-8">
      <div className="container grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Filter panel */}
        <div className="lg:col-span-4 bg-card rounded-xl shadow-md p-6 flex flex-col gap-5">
          <h3 className="font-display text-lg text-navy">Filtro Rápido</h3>

          {/* Category dropdown */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1 block">Categoria</label>
            <div className="relative">
              <select className="w-full appearance-none rounded-lg border border-border bg-background py-2.5 pl-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-green-cta/40">
                <option>Todas as categorias</option>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-meta pointer-events-none" />
            </div>
          </div>

          {/* Price slider */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1 block">
              Preço até <span className="text-navy font-semibold">R$ {price},00</span>
            </label>
            <input
              type="range"
              min={0}
              max={500}
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              className="w-full accent-green-cta"
            />
            <div className="flex justify-between text-xs text-text-meta mt-1">
              <span>R$ 0</span>
              <span>R$ 500</span>
            </div>
          </div>

          {/* Color swatches */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">Cor</label>
            <div className="flex flex-wrap gap-2">
              {swatchColors.map((c, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedColor(i === selectedColor ? null : i)}
                  className={`w-7 h-7 rounded-full ${c} border-2 transition-all ${
                    selectedColor === i ? "border-navy scale-110 ring-2 ring-green-cta/40" : "border-transparent"
                  }`}
                />
              ))}
            </div>
          </div>

          <button className="mt-auto flex items-center justify-center gap-2 rounded-lg bg-green-cta px-4 py-3 font-semibold text-accent-foreground hover:brightness-110 transition">
            <Search size={18} />
            BUSCAR BRINDE
          </button>
        </div>

        {/* Banner */}
        <div className="lg:col-span-8 relative rounded-xl overflow-hidden min-h-[340px] flex items-center">
          <img
            src={heroBanner}
            alt="Brindes corporativos personalizados"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-navy/70" />
          <div className="relative z-10 p-8 md:p-12 max-w-lg">
            <h1 className="text-3xl md:text-4xl lg:text-5xl text-primary-foreground leading-tight mb-4">
              Brindes personalizados para empresas que querem marcar presença
            </h1>
            <p className="text-primary-foreground/80 mb-6">
              Mais de 15 anos entregando qualidade e personalização para o seu negócio.
            </p>
            <a
              href="#categorias"
              className="inline-flex items-center gap-2 rounded-lg bg-green-cta px-6 py-3 font-semibold text-accent-foreground hover:brightness-110 transition"
            >
              Explorar catálogo
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
