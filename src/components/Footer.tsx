import { Instagram, Facebook, MessageCircle, Phone } from "lucide-react";

const paymentLogos = [
  { name: "Visa", src: "/logos/visa.svg" },
  { name: "Mastercard", src: "/logos/mastercard.svg" },
  { name: "American Express", src: "/logos/amex.svg" },
  { name: "Discover", src: "/logos/discover.svg" },
  { name: "Diners Club", src: "/logos/diners.svg" },
  { name: "Elo", src: "/logos/elo.svg" },
  { name: "Aura", src: "/logos/aura.png" },
  { name: "JCB", src: "/logos/jcb.svg" },
  { name: "Pix", src: "/logos/pix.png" },
  { name: "Boleto", src: "/logos/boleto.png" },
];

const securityBadges = [
  { name: "Google Safe Browsing", src: "/logos/google-safe-browsing.png" },
  { name: "GoDaddy Verified & Secured", src: "/logos/godaddy-verified.png" },
  { name: "Google Reviews", src: "/logos/google-reviews.png" },
];

const Footer = () => (
  <footer className="bg-navy-dark text-muted-foreground border-t border-border">
    <div className="container py-10">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        {/* Col 1 – Contato */}
        <div>
          <div className="flex items-baseline gap-0.5 mb-4">
            <span className="text-lg font-extrabold text-foreground">Gift Web</span>
            <span className="text-xs font-semibold text-primary ml-1">brindes</span>
          </div>

          <div className="space-y-2 text-sm">
            <p className="flex items-center gap-2">
              <Phone size={14} className="text-primary" />
              <span>(48) 99665-2844 <span className="text-muted-foreground/60">(SC)</span></span>
            </p>
            <p className="flex items-center gap-2">
              <Phone size={14} className="text-primary" />
              <span>(11) 97016-9697 <span className="text-muted-foreground/60">(SP)</span></span>
            </p>
            <p className="mt-3 text-xs">suporte@giftwebbrindes.com.br</p>
          </div>

          <div className="flex gap-2 mt-4">
            <a href="#" className="w-9 h-9 rounded-full bg-card border border-border flex items-center justify-center hover:border-primary transition-colors text-foreground">
              <Instagram size={16} strokeWidth={1.5} />
            </a>
            <a href="#" className="w-9 h-9 rounded-full bg-card border border-border flex items-center justify-center hover:border-primary transition-colors text-foreground">
              <Facebook size={16} strokeWidth={1.5} />
            </a>
            <a href="https://wa.me/5548996652844" target="_blank" rel="noreferrer" className="w-9 h-9 rounded-full bg-card border border-border flex items-center justify-center hover:border-primary transition-colors text-foreground">
              <MessageCircle size={16} strokeWidth={1.5} />
            </a>
          </div>
        </div>

        {/* Col 2 – Institucional */}
        <div>
          <h4 className="font-semibold mb-4 text-xs uppercase tracking-wider text-foreground">Institucional</h4>
          <ul className="space-y-2 text-sm">
            <li><a href="#" className="hover:text-primary transition-colors">Quem somos</a></li>
            <li><a href="#" className="hover:text-primary transition-colors">Fale conosco</a></li>
            <li><a href="#" className="hover:text-primary transition-colors">Política de troca e devolução</a></li>
          </ul>
        </div>

        {/* Col 3 – Formas de Pagamento */}
        <div>
          <h4 className="font-semibold mb-4 text-xs uppercase tracking-wider text-foreground">Formas de pagamento</h4>
          <div className="flex flex-wrap gap-3 items-center">
            {paymentLogos.map((logo) => (
              <div
                key={logo.name}
                className="h-8 w-12 bg-white rounded flex items-center justify-center p-1"
              >
                <img
                  src={logo.src}
                  alt={logo.name}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Col 4 – Segurança */}
        <div>
          <h4 className="font-semibold mb-4 text-xs uppercase tracking-wider text-foreground">Segurança</h4>
          <div className="flex flex-wrap gap-3 items-center">
            {securityBadges.map((badge) => (
              <div
                key={badge.name}
                className="h-14 w-auto"
              >
                <img
                  src={badge.src}
                  alt={badge.name}
                  className="h-full w-auto object-contain"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>

    {/* Company info */}
    <div className="border-t border-border">
      <div className="container py-6 text-xs text-muted-foreground">
        <p className="font-semibold text-foreground/80 mb-3 text-[11px]">
          COMÉRCIO DE UTILIDADES LUKATI LTDA – GIFT WEB BRINDES
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <p className="font-medium text-foreground/60 mb-1">Matriz Santa Catarina</p>
            <p>Rua Cel Marcos Rovaris, 274 – Centro</p>
            <p>Içara – SC</p>
          </div>
          <div>
            <p className="font-medium text-foreground/60 mb-1">Filial São Paulo</p>
            <p>Avenida Monteiro Lobato, 4550</p>
            <p>Galpão 6 – Setor 7 – Cidade Jardim Cumbica</p>
            <p>Guarulhos – SP</p>
          </div>
        </div>
      </div>
    </div>

    {/* Copyright + brand message */}
    <div className="border-t border-border">
      <div className="container py-5 flex flex-col items-center gap-3 text-center">
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Gift Web Brindes – Todos os direitos reservados
        </p>
        <p className="text-primary font-semibold text-sm italic">
          "Transforme cada brinde em uma lembrança da sua marca."
        </p>
        <p className="text-[10px] text-muted-foreground/60">
          Atendendo empresas em todo o Brasil com brindes personalizados de qualidade.
        </p>
      </div>
    </div>
  </footer>
);

export default Footer;
