import { useState } from "react";
import { Menu, X, Search, MessageCircle, ChevronDown } from "lucide-react";

const categoryLinks = [
  "Garrafas",
  "Copos e Canecas",
  "Mochilas",
  "Bolsas",
  "Escritório",
];

const Header = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50">
      {/* Top bar */}
      <div className="bg-navy text-primary-foreground" style={{ fontSize: 13 }}>
        <div className="container flex items-center justify-center py-2 gap-1">
          <span>Suporte de segunda a sexta-feira das 08h às 18h</span>
          <span className="mx-1">|</span>
          <a
            href="https://wa.me/5548996525312"
            target="_blank"
            rel="noreferrer"
            className="font-bold text-green-cta hover:underline"
          >
            ABRIR WHATSAPP
          </a>
        </div>
      </div>

      {/* Main bar */}
      <div className="bg-card" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
        {/* Line 1: Logo + Search + WhatsApp */}
        <div className="container flex items-center justify-between gap-4 py-3">
          {/* Logo */}
          <a href="/" className="flex items-baseline gap-0.5 shrink-0">
            <span className="text-2xl font-bold text-navy">Gift Web</span>
            <span className="text-sm font-medium text-green-cta ml-1">brindes</span>
          </a>

          {/* Search */}
          <div className="hidden md:flex flex-1 max-w-lg mx-4 relative">
            <input
              type="text"
              placeholder="Estou procurando por..."
              className="w-full rounded-[10px] border border-border bg-background py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-green-cta/40"
            />
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-meta" />
          </div>

          {/* WhatsApp CTA */}
          <a
            href="https://wa.me/5548996525312"
            target="_blank"
            rel="noreferrer"
            className="hidden sm:flex items-center gap-2 rounded-[10px] bg-green-cta px-5 py-2.5 text-sm font-semibold text-accent-foreground hover:brightness-110 transition-all duration-200 shrink-0"
          >
            <MessageCircle size={16} />
            (48) 99652-5312
          </a>

          {/* Mobile toggle */}
          <button onClick={() => setMobileOpen(!mobileOpen)} className="lg:hidden text-foreground">
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Line 2: Category nav */}
        <div className="hidden lg:block border-t border-border">
          <div className="container flex items-center gap-0 py-0">
            {/* All products button */}
            <a
              href="#produtos"
              className="flex items-center gap-2 bg-navy text-primary-foreground px-5 py-3 rounded-[8px] my-1 text-sm font-bold uppercase hover:bg-navy-hover transition-colors duration-200 shrink-0"
            >
              <Menu size={16} />
              TODOS BRINDES
            </a>

            {categoryLinks.map((cat) => (
              <a
                key={cat}
                href={`#${cat.toLowerCase().replace(/\s/g, "-")}`}
                className="px-4 py-3 text-sm font-bold uppercase text-foreground hover:text-green-cta transition-colors duration-200"
              >
                {cat}
              </a>
            ))}

            <a
              href="#ofertas"
              className="px-4 py-3 text-sm font-bold uppercase text-danger hover:opacity-80 transition-colors duration-200"
            >
              OFERTAS
            </a>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-border pb-4">
            <div className="container flex flex-col gap-3 pt-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Estou procurando por..."
                  className="w-full rounded-[10px] border border-border bg-background py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-green-cta/40"
                />
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-meta" />
              </div>

              <a
                href="#produtos"
                className="flex items-center gap-2 bg-navy text-primary-foreground px-4 py-2.5 rounded-[8px] text-sm font-bold uppercase"
              >
                <Menu size={16} />
                TODOS BRINDES
              </a>

              {categoryLinks.map((cat) => (
                <a
                  key={cat}
                  href={`#${cat.toLowerCase().replace(/\s/g, "-")}`}
                  className="text-sm font-bold uppercase text-foreground hover:text-green-cta py-1"
                >
                  {cat}
                </a>
              ))}

              <a href="#ofertas" className="text-sm font-bold uppercase text-danger py-1">
                OFERTAS
              </a>

              <a
                href="https://wa.me/5548996525312"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 rounded-[10px] bg-green-cta px-4 py-2.5 text-sm font-semibold text-accent-foreground"
              >
                <MessageCircle size={16} />
                (48) 99652-5312
              </a>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
