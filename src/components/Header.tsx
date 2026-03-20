import { useState, useEffect, useRef } from "react";
import { Menu, X, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { WHATSAPP_NUMBER } from "@/config/site";

const categoryLinks = [
  { name: "Garrafas", route: "/garrafas" },
  { name: "Copos e Canecas", route: "/copos" },
  { name: "Mochilas", route: "/mochilas" },
  { name: "Bolsas", route: "/bolsas" },
  { name: "Escritório", route: "/escritorio" },
  { name: "Squeezes", route: "/squeezes" },
];

const Header = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const lastScrollY = useRef(0);
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 10);

      if (y > 80) {
        // Scrolling down → hide; scrolling up → show
        setHidden(y > lastScrollY.current);
      } else {
        setHidden(false);
      }
      lastScrollY.current = y;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchTerm.trim();
    if (q) {
      navigate(`/busca?q=${encodeURIComponent(q)}`);
      setSearchTerm("");
      setMobileOpen(false);
    }
  };

  const phoneFormatted = "(48) 99665-2844";

  return (
    <>
      {/* Full header — hides on scroll down */}
      <header
        className={`sticky top-0 z-50 overflow-x-hidden transition-transform duration-300 ${
          hidden ? "-translate-y-full" : "translate-y-0"
        }`}
      >
        {/* Top bar */}
        <div className="bg-navy-dark text-muted-foreground" style={{ fontSize: 13 }}>
          <div className="container flex flex-col sm:flex-row items-center justify-center py-2 gap-0 sm:gap-1">
            <span className="text-primary-foreground text-center leading-snug">
              ⚡ Atendimento rápido via WhatsApp&nbsp;&nbsp;&nbsp;💳 Pagamento Facilitado
            </span>
            <span className="hidden sm:inline mx-1">|</span>
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}`}
              target="_blank"
              rel="noreferrer"
              className="font-bold text-green-cta hover:underline"
            >
              Atendimento Comercial
            </a>
          </div>
        </div>

        {/* Main bar */}
        <div
          className="border-b border-border transition-all duration-300"
          style={{
            backgroundColor: scrolled ? "rgba(11,15,26,0.92)" : "hsl(222,47%,7%)",
            backdropFilter: scrolled ? "blur(12px)" : "none",
          }}
        >
          {/* Line 1 */}
          <div className="container flex items-center justify-between gap-4 py-3">
            <a href="/" className="flex items-baseline gap-0.5 shrink-0 min-w-0">
              <span className="font-extrabold font-serif text-left text-3xl sm:text-4xl md:text-5xl text-primary-foreground leading-none">
                Gift Web
              </span>
              <span className="text-xs sm:text-sm font-medium text-green-cta ml-1 whitespace-nowrap">
                B R I N D E S
              </span>
            </a>

            {/* Search */}
            <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-lg mx-4 relative">
              <input
                type="text"
                placeholder="Estou procurando por..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-[10px] border border-border bg-card py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-text-meta focus:outline-none focus:ring-2 focus:ring-green-cta/40"
              />
              <button type="submit" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-meta">
                <Search size={16} />
              </button>
            </form>

            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}`}
              target="_blank"
              rel="noreferrer"
              className="hidden sm:flex items-center gap-2 rounded-[10px] bg-green-cta px-5 py-2.5 text-sm font-bold text-primary-foreground hover:brightness-110 transition-all duration-200 shrink-0"
              style={{ boxShadow: "0 0 20px rgba(34,197,94,0.3)" }}
            >
              <img src="/logos/whatsapp-white.svg" alt="WhatsApp" className="w-4 h-4" />
              {phoneFormatted}
            </a>

            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden text-foreground p-1"
            >
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>

          {/* Category nav — desktop */}
          <div className="hidden lg:block border-t border-border bg-surface-alt">
            <div className="container flex items-center gap-0 py-0">
              <a
                href="/produtos"
                className="flex items-center gap-2 bg-secondary text-foreground px-5 py-3 rounded-[8px] my-1 text-[13px] font-bold uppercase hover:bg-navy-hover transition-colors duration-200 shrink-0"
              >
                <Menu size={16} />
                TODOS BRINDES
              </a>

              {categoryLinks.map((cat) => (
                <a
                  key={cat.name}
                  href={cat.route}
                  className="px-4 py-3 text-[13px] font-bold uppercase text-muted-foreground hover:text-green-cta transition-colors duration-200"
                >
                  {cat.name}
                </a>
              ))}

              <a
                href="/brindes-baratos"
                className="px-4 py-3 text-[13px] font-bold uppercase hover:opacity-80 transition-colors duration-200 text-green-cta"
              >
                BRINDES BARATOS
              </a>
            </div>
          </div>

          {/* Mobile menu */}
          {mobileOpen && (
            <div className="lg:hidden border-t border-border pb-4">
              <div className="container flex flex-col gap-3 pt-3">
                <form onSubmit={handleSearch} className="relative">
                  <input
                    type="text"
                    placeholder="Estou procurando por..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full rounded-[10px] border border-border bg-card py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-text-meta focus:outline-none focus:ring-2 focus:ring-green-cta/40"
                  />
                  <button type="submit" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-meta">
                    <Search size={16} />
                  </button>
                </form>

                <a
                  href="/produtos"
                  className="flex items-center gap-2 bg-secondary text-foreground px-4 py-2.5 rounded-[8px] text-sm font-bold uppercase"
                >
                  <Menu size={16} />
                  TODOS BRINDES
                </a>

                {categoryLinks.map((cat) => (
                  <a
                    key={cat.name}
                    href={cat.route}
                    className="text-sm font-bold uppercase text-muted-foreground hover:text-green-cta py-1"
                  >
                    {cat.name}
                  </a>
                ))}

                <a href="/brindes-baratos" className="text-sm font-bold uppercase text-green-cta py-1">
                  BRINDES BARATOS
                </a>

                <a
                  href={`https://wa.me/${WHATSAPP_NUMBER}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 rounded-[10px] bg-green-cta px-4 py-2.5 text-sm font-bold text-primary-foreground"
                  style={{ boxShadow: "0 0 20px rgba(34,197,94,0.3)" }}
                >
                  <img src="/logos/whatsapp-white.svg" alt="WhatsApp" className="w-4 h-4" />
                  {phoneFormatted}
                </a>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Floating hamburger — only visible on mobile when header is hidden */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className={`lg:hidden fixed top-3 right-4 z-[60] rounded-full w-10 h-10 flex items-center justify-center bg-navy/90 backdrop-blur-sm border border-white/10 text-white shadow-lg transition-all duration-300 ${
          hidden ? "opacity-100 translate-y-0" : "opacity-0 pointer-events-none -translate-y-2"
        }`}
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Mobile menu overlay — shown when header is hidden but menu is open */}
      {mobileOpen && hidden && (
        <div className="lg:hidden fixed top-14 left-0 right-0 z-[59] bg-navy/95 backdrop-blur-md border-b border-white/10 pb-4 overflow-x-hidden">
          <div className="container flex flex-col gap-3 pt-3">
            <form onSubmit={handleSearch} className="relative">
              <input
                type="text"
                placeholder="Estou procurando por..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-[10px] border border-border bg-card py-2.5 pl-10 pr-4 text-sm text-foreground placeholder:text-text-meta focus:outline-none focus:ring-2 focus:ring-green-cta/40"
              />
              <button type="submit" className="absolute left-3 top-1/2 -translate-y-1/2 text-text-meta">
                <Search size={16} />
              </button>
            </form>

            <a href="/produtos" className="flex items-center gap-2 bg-secondary text-foreground px-4 py-2.5 rounded-[8px] text-sm font-bold uppercase">
              <Menu size={16} />
              TODOS BRINDES
            </a>

            {categoryLinks.map((cat) => (
              <a key={cat.name} href={cat.route} className="text-sm font-bold uppercase text-muted-foreground hover:text-green-cta py-1">
                {cat.name}
              </a>
            ))}

            <a href="/brindes-baratos" className="text-sm font-bold uppercase text-green-cta py-1">
              BRINDES BARATOS
            </a>

            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 rounded-[10px] bg-green-cta px-4 py-2.5 text-sm font-bold text-primary-foreground"
              style={{ boxShadow: "0 0 20px rgba(34,197,94,0.3)" }}
            >
              <img src="/logos/whatsapp-white.svg" alt="WhatsApp" className="w-4 h-4" />
              {phoneFormatted}
            </a>
          </div>
        </div>
      )}
    </>
  );
};

export default Header;
