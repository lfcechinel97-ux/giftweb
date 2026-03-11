import { useState } from "react";
import { Menu, X, Search, MessageCircle } from "lucide-react";

const navLinks = ["Produtos", "Categorias", "Sobre", "Contato"];

const Header = () => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50">
      {/* Top bar */}
      <div className="bg-navy text-primary-foreground text-sm">
        <div className="container flex items-center justify-between py-2">
          <span className="hidden sm:inline">Suporte seg–sex 08h–18h</span>
          <a
            href="https://wa.me/5548996525312"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 font-medium hover:underline ml-auto sm:ml-0"
          >
            <MessageCircle size={14} />
            ABRIR WHATSAPP
          </a>
        </div>
      </div>

      {/* Main bar */}
      <div className="bg-card shadow-sm">
        <div className="container flex items-center justify-between gap-4 py-3">
          {/* Logo */}
          <a href="/" className="flex items-baseline gap-0.5 shrink-0">
            <span className="text-2xl font-display text-navy">Gift Web</span>
            <span className="text-sm font-semibold text-green-cta ml-1">brindes</span>
          </a>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-6">
            {navLinks.map((l) => (
              <a key={l} href={`#${l.toLowerCase()}`} className="text-sm font-medium text-foreground hover:text-green-cta transition-colors">
                {l}
              </a>
            ))}
          </nav>

          {/* Search */}
          <div className="hidden md:flex flex-1 max-w-md mx-4 relative">
            <input
              type="text"
              placeholder="Buscar brindes..."
              className="w-full rounded-lg border border-border bg-background py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-green-cta/40"
            />
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-meta" />
          </div>

          {/* WhatsApp CTA */}
          <a
            href="https://wa.me/5548996525312"
            target="_blank"
            rel="noreferrer"
            className="hidden sm:flex items-center gap-2 rounded-lg bg-green-cta px-4 py-2 text-sm font-semibold text-accent-foreground hover:brightness-110 transition shrink-0"
          >
            <MessageCircle size={16} />
            (48) 99652-5312
          </a>

          {/* Mobile toggle */}
          <button onClick={() => setMobileOpen(!mobileOpen)} className="lg:hidden text-foreground">
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-border pb-4">
            <div className="container flex flex-col gap-3 pt-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar brindes..."
                  className="w-full rounded-lg border border-border bg-background py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-green-cta/40"
                />
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-meta" />
              </div>
              {navLinks.map((l) => (
                <a key={l} href={`#${l.toLowerCase()}`} className="text-sm font-medium text-foreground hover:text-green-cta py-1">
                  {l}
                </a>
              ))}
              <a
                href="https://wa.me/5548996525312"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 rounded-lg bg-green-cta px-4 py-2 text-sm font-semibold text-accent-foreground"
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
