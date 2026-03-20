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
        setHidden(y > lastScrollY.current);
      } else {
        setHidden(false);
      }
      lastScrollY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock page scroll when menu is open (iOS-safe)
  useEffect(() => {
    if (mobileOpen) {
      const scrollY = window.scrollY;
      document.body.style.position = "fixed";
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = "100%";
      document.body.style.overflow = "hidden";
    } else {
      const top = document.body.style.top;
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      document.body.style.overflow = "";
      if (top) window.scrollTo(0, -parseInt(top, 10));
    }
    return () => {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

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

            {/* Search desktop */}
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
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 shrink-0">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              {phoneFormatted}
            </a>

            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden text-white p-1 z-[110] relative"
            >
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>

          {/* Category nav — desktop only */}
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
        </div>
      </header>

      {/* ── MOBILE FULLSCREEN MENU ── */}
      <div
        className={`lg:hidden fixed inset-0 z-[100] bg-navy flex flex-col transition-opacity duration-300 ${
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Fixed header row inside menu */}
        <div className="flex items-center justify-between px-6 pt-5 pb-5 border-b border-white/10 shrink-0">
          <a href="/" onClick={() => setMobileOpen(false)} className="flex items-baseline gap-1">
            <span className="font-extrabold font-serif text-3xl text-white">Gift Web</span>
            <span className="text-xs font-semibold text-green-cta ml-1">B R I N D E S</span>
          </a>
          <button onClick={() => setMobileOpen(false)} className="text-white p-1">
            <X size={26} />
          </button>
        </div>

        {/* Search — fixed inside menu */}
        <div className="px-6 py-4 shrink-0">
          <form onSubmit={handleSearch} className="relative">
            <input
              type="text"
              placeholder="Estou procurando por..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-[10px] border border-white/20 bg-white/10 py-3 pl-10 pr-4 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-green-cta/40"
            />
            <button type="submit" className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50">
              <Search size={16} />
            </button>
          </form>
        </div>

        {/* Scrollable nav area */}
        <nav className="px-6 flex flex-col gap-1 overflow-y-auto flex-1 pb-10">
          <a
            href="/produtos"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 py-4 text-base font-bold uppercase text-white border-b border-white/10"
          >
            <Menu size={18} className="text-green-cta" />
            Todos Brindes
          </a>
          {categoryLinks.map((cat) => (
            <a
              key={cat.name}
              href={cat.route}
              onClick={() => setMobileOpen(false)}
              className="py-4 text-base font-semibold text-white/70 hover:text-white border-b border-white/10 transition-colors"
            >
              {cat.name}
            </a>
          ))}
          <a
            href="/brindes-baratos"
            onClick={() => setMobileOpen(false)}
            className="py-4 text-base font-bold text-green-cta border-b border-white/10"
          >
            Brindes Baratos
          </a>

          {/* WhatsApp CTA */}
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}`}
            target="_blank"
            rel="noreferrer"
            className="mt-6 flex items-center justify-center gap-3 rounded-2xl bg-green-cta px-6 py-4 text-sm font-bold text-white"
            style={{ boxShadow: "0 0 24px rgba(34,197,94,0.35)" }}
          >
            <img src="/logos/whatsapp-white.svg" alt="WhatsApp" className="w-5 h-5" />
            {phoneFormatted}
          </a>
        </nav>
      </div>

      {/* Floating hamburger — visible on mobile only when header is scrolled out */}
      <button
        onClick={() => setMobileOpen(true)}
        className={`lg:hidden fixed top-3 right-4 z-[60] rounded-full w-10 h-10 flex items-center justify-center bg-navy/90 backdrop-blur-sm border border-white/10 text-white shadow-lg transition-all duration-300 ${
          hidden && !mobileOpen ? "opacity-100 translate-y-0" : "opacity-0 pointer-events-none -translate-y-2"
        }`}
      >
        <Menu size={20} />
      </button>
    </>
  );
};

export default Header;
