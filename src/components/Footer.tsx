import { Instagram, Facebook, MessageCircle, Phone, MapPin, ShieldCheck, Lock, CreditCard } from "lucide-react";

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
  { name: "SSL Secure", icon: Lock, color: "text-green-cta" },
  { name: "Compra Segura", icon: ShieldCheck, color: "text-green-cta" },
  { name: "Mercado Pago", icon: CreditCard, color: "text-[#009ee3]" },
  { name: "Stone Pagamentos", icon: ShieldCheck, color: "text-[#00a868]" },
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
              <div key={logo.name} className="h-8 w-12 bg-white rounded flex items-center justify-center p-1">
                <img src={logo.src} alt={logo.name} className="max-h-full max-w-full object-contain" />
              </div>
            ))}
          </div>
        </div>

        {/* Col 4 – Segurança */}
        <div>
          <h4 className="font-semibold mb-4 text-xs uppercase tracking-wider text-foreground">Segurança</h4>
          <div className="grid grid-cols-2 gap-3">
            {securityBadges.map((badge) => (
              <div
                key={badge.name}
                className="flex flex-col items-center gap-2 p-3 rounded-xl bg-card border border-border"
              >
                <badge.icon size={28} className={badge.color} strokeWidth={1.5} />
                <span className="text-[10px] text-center text-muted-foreground font-semibold leading-tight">{badge.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>

    {/* Company info with location icons */}
    <div className="border-t border-border">
      <div className="container py-6">
        <p className="font-semibold text-foreground/80 mb-4 text-[11px] text-center uppercase tracking-wider">
          COMÉRCIO DE UTILIDADES LUKATI LTDA – GIFT WEB BRINDES
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-8 text-xs text-muted-foreground">
          <div className="text-center">
            <p className="flex items-center justify-center gap-1.5 font-medium text-foreground/70 mb-1">
              <MapPin size={14} className="text-primary" />
              Matriz – Santa Catarina
            </p>
            <p>Rua Cel Marcos Rovaris, 274 – Centro</p>
            <p>Içara – SC</p>
          </div>
          <div className="text-center">
            <p className="flex items-center justify-center gap-1.5 font-medium text-foreground/70 mb-1">
              <MapPin size={14} className="text-primary" />
              Filial – São Paulo
            </p>
            <p>Avenida Monteiro Lobato, 4550</p>
            <p>Galpão 6 – Setor 7 – Cidade Jardim Cumbica</p>
            <p>Guarulhos – SP</p>
          </div>
        </div>
      </div>
    </div>

    {/* Copyright */}
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
