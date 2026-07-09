import { useState, useEffect, useRef } from "react";
import { Menu, X, Search, ChevronDown, ChevronRight } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { WHATSAPP_REDIRECT_URL } from "@/config/site";

const menuSections = [
  {
    title: "Copos, Garrafas e Canecas",
    items: [
      { name: "Copos", slug: "copos" },
      { name: "Garrafas Térmicas / Squeezes", slug: "garrafas-termicas" },
      { name: "Garrafas de Inox / Alumínio", slug: "garrafas-inox-aluminio" },
      { name: "Canecas", slug: "canecas" },
    ],
  },
  {
    title: "Mochilas, Bolsas Térmicas e Malas",
    items: [
      { name: "Mochilas e Sacochilas", slug: "mochilas-e-sacochilas" },
      { name: "Bolsas Térmicas", slug: "bolsas" },
      { name: "Malas de Viagem", slug: "malas" },
    ],
  },
  {
    title: "Necessaires, Porta Joias e Kit Manicure",
    items: [
      { name: "Necessaires", slug: "necessaires" },
      { name: "Porta Joias", slug: "porta-joias" },
      { name: "Kit Manicure", slug: "kit-manicure" },
    ],
  },
  {
    title: "Cadernetas, Agendas, Blocos e Canetas",
    items: [
      { name: "Cadernetas", slug: "cadernetas" },
      { name: "Agendas", slug: "agendas" },
      { name: "Blocos de Anotações", slug: "blocos" },
      { name: "Canetas", slug: "canetas" },
    ],
  },
  {
    title: "Chaveiros, Mouse Pad e Kit Executivo",
    items: [
      { name: "Chaveiros", slug: "chaveiros" },
      { name: "Mouse Pad", slug: "mouse-pads" },
      { name: "Kit Executivo", slug: "kit-executivo" },
    ],
  },
  {
    title: "Caixas de Som, Fones e Power Bank",
    items: [
      { name: "Caixas de Som", slug: "caixas-de-som" },
      { name: "Fones de Ouvido", slug: "fones" },
      { name: "Power Banks", slug: "power-banks" },
    ],
  },
  {
    title: "Sacola de Algodão e TNT",
    items: [
      { name: "Sacolas de Algodão e TNT", slug: "sacolas" },
    ],
  },
  {
    title: "Kit Churrasco e Kit Vinho",
    items: [
      { name: "Kit Churrasco", slug: "kit-churrasco" },
      { name: "Kit Vinho", slug: "kit-vinho" },
    ],
  },
  {
    title: "Marmitas e Tábuas de Madeira",
    items: [
      { name: "Marmitas", slug: "marmitas" },
      { name: "Tábuas e Petisqueiras", slug: "tabuas-petisqueiras" },
    ],
  },
  {
    title: "Guarda-Chuvas",
    items: [
      { name: "Guarda-Chuvas", slug: "guarda-chuvas" },
    ],
  },
];

const Header = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [megaMenuOpen, setMegaMenuOpen] = useState(false);
  const [openMobileSection, setOpenMobileSection] = useState<string | null>(null);
  const lastScrollY = useRef(0);
  const megaMenuTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const handleMegaEnter = () => {
    if (megaMenuTimeout.current) clearTimeout(megaMenuTimeout.current);
    setMegaMenuOpen(true);
  };
  const handleMegaLeave = () => {
    megaMenuTimeout.current = setTimeout(() => setMegaMenuOpen(false), 200);
  };

  const phoneFormatted = "(48) 99665-2844";

  return (
    <>
      <header
        className={`sticky top-0 z-50 transition-transform duration-300 ${
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
              href={WHATSAPP_REDIRECT_URL}
              target="_blank"
              rel="noopener noreferrer"
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
          <div className="container flex items-center justify-between gap-4 py-3">
            <a href="/" className="flex items-baseline gap-0.5 shrink-0 min-w-0">
              <span className="font-extrabold font-serif text-left text-3xl sm:text-4xl md:text-5xl text-primary-foreground leading-none">
                Gift Web
              </span>
              <span className="text-xs sm:text-sm font-medium text-green-cta ml-1 whitespace-nowrap">
                B R I N D E S
              </span>
            </a>

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
              href={WHATSAPP_REDIRECT_URL}
              target="_blank"
              rel="noopener noreferrer"
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

          {/* Category nav — desktop with mega-menu */}
          <div className="hidden lg:block border-t border-border bg-surface-alt">
            <div className="container flex items-center gap-0 py-0">
              <Link
                to="/produtos"
                className="flex items-center gap-2 bg-secondary text-foreground px-5 py-3 rounded-[8px] my-1 text-[13px] font-bold uppercase hover:bg-navy-hover transition-colors duration-200 shrink-0"
              >
                <Menu size={16} />
                TODOS BRINDES
              </Link>

              {/* Mega-menu trigger */}
              <div
                className="relative"
                onMouseEnter={handleMegaEnter}
                onMouseLeave={handleMegaLeave}
              >
                <button
                  aria-haspopup="true"
                  aria-expanded={megaMenuOpen}
                  className="flex items-center gap-1 px-4 py-3 text-[13px] font-bold uppercase text-muted-foreground hover:text-green-cta transition-colors duration-200"
                >
                  CATEGORIAS
                  <ChevronDown size={14} className={`transition-transform duration-200 ${megaMenuOpen ? "rotate-180" : ""}`} />
                </button>

                {/* Mega-menu dropdown */}
                <div
                  className={`absolute left-0 top-full bg-card border border-border rounded-xl shadow-2xl transition-all duration-200 ${
                    megaMenuOpen ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-2 pointer-events-none"
                  }`}
                  style={{ width: 720, zIndex: 60 }}
                >
                  <div className="grid grid-cols-3 gap-0 p-5">
                    {menuSections.map((section) => (
                      <div key={section.title} className="mb-4">
                        <h4 className="text-xs font-bold uppercase text-green-cta tracking-wider mb-2 px-2">
                          {section.title}
                        </h4>
                        <ul className="space-y-0.5">
                          {section.items.map((item) => (
                            <li key={item.slug}>
                              <Link
                                to={`/categoria/${item.slug}`}
                                onClick={() => setMegaMenuOpen(false)}
                                className="block px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md transition-colors duration-150"
                              >
                                {item.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Quick links for top categories */}
              <Link to="/categoria/garrafas-termicas" className="px-4 py-3 text-[13px] font-bold uppercase text-muted-foreground hover:text-green-cta transition-colors duration-200">
                Garrafas
              </Link>
              <Link to="/categoria/copos" className="px-4 py-3 text-[13px] font-bold uppercase text-muted-foreground hover:text-green-cta transition-colors duration-200">
                Copos
              </Link>
              <Link to="/categoria/mochilas-e-sacochilas" className="px-4 py-3 text-[13px] font-bold uppercase text-muted-foreground hover:text-green-cta transition-colors duration-200">
                Mochilas
              </Link>
              <Link to="/categoria/kit-churrasco" className="px-4 py-3 text-[13px] font-bold uppercase text-muted-foreground hover:text-green-cta transition-colors duration-200">
                Kit Churrasco
              </Link>
              <Link
                to="/categoria/dia-dos-pais"
                className="px-4 py-3 text-[13px] font-black uppercase transition-colors duration-200 hover:brightness-110"
                style={{ color: "hsl(217 91% 60%)" }}
              >
                Dia dos Pais
              </Link>
              <Link to="/catalogo" className="px-4 py-3 text-[13px] font-bold uppercase text-muted-foreground hover:text-green-cta transition-colors duration-200">
                Catálogo
              </Link>

            </div>
          </div>
        </div>
      </header>

      {/* ── MOBILE FULLSCREEN MENU ── */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Menu de navegação"
        className={`lg:hidden fixed inset-0 z-[100] bg-navy flex flex-col transition-opacity duration-300 ${
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-5 border-b border-white/10 shrink-0">
          <a href="/" onClick={() => setMobileOpen(false)} className="flex items-baseline gap-1">
            <span className="font-extrabold font-serif text-3xl text-white">Gift Web</span>
            <span className="text-xs font-semibold text-green-cta ml-1">B R I N D E S</span>
          </a>
          <button onClick={() => setMobileOpen(false)} className="text-white p-1">
            <X size={26} />
          </button>
        </div>

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

        <nav className="px-6 flex flex-col gap-0 overflow-y-auto flex-1 pb-10">
          <Link
            to="/produtos"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 py-4 text-base font-bold uppercase text-white border-b border-white/10"
          >
            <Menu size={18} className="text-green-cta" />
            Todos Brindes
          </Link>
          <Link
            to="/categoria/dia-dos-pais"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 py-4 text-base font-black uppercase border-b border-white/10"
            style={{ color: "hsl(217 91% 60%)" }}
          >
            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: "hsl(217 91% 60%)" }} />
            Dia dos Pais
          </Link>
          <Link
            to="/catalogo"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 py-4 text-base font-bold uppercase text-white border-b border-white/10"
          >
            <Search size={18} className="text-green-cta" />
            Catálogo
          </Link>


          {menuSections.map((section) => (
            <div key={section.title} className="border-b border-white/10">
              <button
                onClick={() => setOpenMobileSection(openMobileSection === section.title ? null : section.title)}
                className="flex items-center justify-between w-full py-4 text-base font-semibold text-white/90"
              >
                {section.title}
                <ChevronRight
                  size={16}
                  className={`text-green-cta transition-transform duration-200 ${
                    openMobileSection === section.title ? "rotate-90" : ""
                  }`}
                />
              </button>
              {openMobileSection === section.title && (
                <div className="pb-3 pl-4 space-y-1">
                  {section.items.map((item) => (
                    <Link
                      key={item.slug}
                      to={`/categoria/${item.slug}`}
                      onClick={() => setMobileOpen(false)}
                      className="block py-2 text-sm text-white/60 hover:text-white transition-colors"
                    >
                      {item.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}

          <a
            href={WHATSAPP_REDIRECT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 flex items-center justify-center gap-3 rounded-2xl bg-green-cta px-6 py-4 text-sm font-bold text-white"
            style={{ boxShadow: "0 0 24px rgba(34,197,94,0.35)" }}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 shrink-0">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            {phoneFormatted}
          </a>
        </nav>
      </div>

      {/* Floating hamburger */}
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
