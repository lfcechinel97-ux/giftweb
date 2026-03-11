import { Instagram, Facebook, MessageCircle, Phone } from "lucide-react";

const paymentMethods = [
  "Visa", "Mastercard", "Amex", "Elo", "Hipercard", "JCB", "Pix", "Boleto",
];

const securitySeals = [
  "SSL Secure",
  "Compra Segura",
  "Mercado Pago",
  "Stone",
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
          <h4 className="font-semibold mb-4 text-xs uppercase tracking-wider text-foreground">Formas de Pagamento</h4>
          <div className="grid grid-cols-4 gap-2">
            {paymentMethods.map((method) => (
              <div
                key={method}
                className="h-9 rounded-md bg-card border border-border flex items-center justify-center"
              >
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide">{method}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Col 4 – Segurança */}
        <div>
          <h4 className="font-semibold mb-4 text-xs uppercase tracking-wider text-foreground">Segurança</h4>
          <div className="grid grid-cols-2 gap-2">
            {securitySeals.map((seal) => (
              <div
                key={seal}
                className="rounded-lg bg-card border border-border p-3 flex flex-col items-center justify-center text-center"
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mb-1">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <span className="text-[9px] font-semibold text-muted-foreground leading-tight">{seal}</span>
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
