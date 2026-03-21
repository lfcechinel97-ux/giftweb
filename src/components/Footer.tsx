import { Phone, Mail, Instagram, Facebook, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { useSiteContent } from "@/hooks/useSiteContent";

const WhatsAppIcon = ({ size = 16 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2z"/>
  </svg>
);

const Footer = () => {
  const { rows } = useSiteContent("footer");

  const get = (id: string) => rows.find((r) => r.id === id)?.value || "";

  const footerLogo = get("footer_logo");
  const tel1 = get("footer_telefone_1") || "(48) 99665-2844";
  const tel2 = get("footer_telefone_2") || "(11) 97016-9697";
  const email = get("footer_email") || "suporte@giftwebbrindes.com.br";
  const endereco1 = get("footer_endereco_1") || "Rua Cel Marcos Rovaris, 274 – Centro, Içara – SC";
  const endereco2 = get("footer_endereco_2") || "Av. Monteiro Lobato, 4550 – Galpão 6 – Setor 7 – Cidade Jardim Cumbica, Guarulhos – SP";
  const frase = get("footer_frase") || "Transforme cada brinde em uma lembrança da sua marca.";
  const linkInsta = get("footer_link_instagram") || "#";
  const linkFb = get("footer_link_facebook") || "#";
  const linkWa = get("footer_link_whatsapp") || "https://wa.me/5548996652844";

  const paymentLogos = Array.from({ length: 8 }, (_, i) => get(`payment_logo_${i + 1}`));
  const securityLogos = Array.from({ length: 4 }, (_, i) => get(`security_${i + 1}`));

  return (
    <footer className="bg-[#0B0F1A] text-white">
      {/* Main 4 columns */}
      <div className="container py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Col 1 — Gift Web */}
          <div>
            {footerLogo ? (
              <img src={footerLogo} alt="Gift Web Brindes" className="h-10 w-auto mb-5 object-contain" />
            ) : (
              <div className="mb-5">
                <span className="text-lg font-extrabold">Gift Web</span>
                <span className="text-xs font-semibold text-[#22C55E] ml-1">brindes</span>
              </div>
            )}

            <div className="space-y-3 text-sm">
              <a href={`tel:${tel1.replace(/\D/g, "")}`} className="flex items-center gap-2.5 text-[#9CA3AF] hover:text-white transition-colors">
                <Phone size={14} className="text-[#22C55E] shrink-0" />
                <span>{tel1} <span className="text-[#9CA3AF]/60">(SC)</span></span>
              </a>
              <a href={`tel:${tel2.replace(/\D/g, "")}`} className="flex items-center gap-2.5 text-[#9CA3AF] hover:text-white transition-colors">
                <Phone size={14} className="text-[#22C55E] shrink-0" />
                <span>{tel2} <span className="text-[#9CA3AF]/60">(SP)</span></span>
              </a>
              <a href={`mailto:${email}`} className="flex items-center gap-2.5 text-[#9CA3AF] hover:text-white transition-colors">
                <Mail size={14} className="text-[#22C55E] shrink-0" />
                <span className="text-xs">{email}</span>
              </a>
            </div>

            <div className="flex gap-2.5 mt-5">
              <a href={linkInsta} target="_blank" rel="noreferrer" className="w-9 h-9 rounded-full border border-white/10 flex items-center justify-center text-[#9CA3AF] hover:text-white hover:border-[#22C55E]/40 transition-colors">
                <Instagram size={16} strokeWidth={1.5} />
              </a>
              <a href={linkFb} target="_blank" rel="noreferrer" className="w-9 h-9 rounded-full border border-white/10 flex items-center justify-center text-[#9CA3AF] hover:text-white hover:border-[#22C55E]/40 transition-colors">
                <Facebook size={16} strokeWidth={1.5} />
              </a>
              <a href={linkWa} target="_blank" rel="noreferrer" className="w-9 h-9 rounded-full border border-white/10 flex items-center justify-center text-[#9CA3AF] hover:text-white hover:border-[#22C55E]/40 transition-colors">
                <WhatsAppIcon size={16} />
              </a>
            </div>
          </div>

          {/* Col 2 — Institucional */}
          <div>
            <h4 className="text-[#22C55E] font-semibold text-xs uppercase tracking-wider mb-5">Institucional</h4>
            <ul className="space-y-3 text-sm">
              <li><a href="#" className="text-[#9CA3AF] hover:text-white transition-colors">Quem somos</a></li>
              <li><a href="#" className="text-[#9CA3AF] hover:text-white transition-colors">Fale conosco</a></li>
              <li><a href="#" className="text-[#9CA3AF] hover:text-white transition-colors">Política de troca e devolução</a></li>
              <li><Link to="/politica-de-privacidade" className="text-[#9CA3AF] hover:text-white transition-colors">Política de Privacidade</Link></li>
              <li><Link to="/termos-de-uso" className="text-[#9CA3AF] hover:text-white transition-colors">Termos de Uso</Link></li>
              <li><Link to="/seguranca" className="text-[#9CA3AF] hover:text-white transition-colors">Segurança</Link></li>
            </ul>
          </div>

          {/* Col 3 — Formas de Pagamento */}
          <div>
            <h4 className="text-[#22C55E] font-semibold text-xs uppercase tracking-wider mb-5">Formas de pagamento</h4>
            <div className="flex items-center justify-center">
              <img
                src="/logos/formaspags.png"
                alt="Formas de pagamento aceitas"
                className="w-full max-w-[220px] object-contain"
              />
            </div>
          </div>

          {/* Col 4 — Segurança */}
          <div>
            <h4 className="text-[#22C55E] font-semibold text-xs uppercase tracking-wider mb-5">Segurança</h4>
            <div className="bg-[#1a1f2e] rounded-xl p-4 flex items-center justify-center">
              <img
                src="/logos/ssl.svg"
                alt="Site seguro SSL"
                className="w-full max-w-[200px] object-contain"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Endereços */}
      <div className="border-t border-[rgba(34,197,94,0.15)]">
        <div className="container py-6">
          <div className="flex flex-col sm:flex-row justify-center gap-8 text-xs text-[#9CA3AF]">
            <div className="text-center">
              <p className="flex items-center justify-center gap-1.5 font-medium text-white/80 mb-1">
                <MapPin size={14} className="text-[#22C55E]" />
                Matriz – Santa Catarina
              </p>
              <p>{endereco1}</p>
            </div>
            <div className="text-center">
              <p className="flex items-center justify-center gap-1.5 font-medium text-white/80 mb-1">
                <MapPin size={14} className="text-[#22C55E]" />
                Filial – São Paulo
              </p>
              <p>{endereco2}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Copyright */}
      <div className="border-t border-[rgba(34,197,94,0.15)]">
        <div className="container py-5 flex flex-col items-center gap-2 text-center">
          <p className="text-xs text-[#9CA3AF]">
            © {new Date().getFullYear()} Gift Web Brindes – Todos os direitos reservados
          </p>
          <p className="text-[#22C55E] font-semibold text-sm italic">
            "{frase}"
          </p>
          <p className="text-[10px] text-[#9CA3AF]/60">
            Atendendo empresas em todo o Brasil com brindes personalizados de qualidade.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
