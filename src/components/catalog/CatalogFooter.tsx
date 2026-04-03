import { Phone, Mail, MapPin } from "lucide-react";

const CatalogFooter = () => {
  return (
    <footer className="bg-[#0B0F1A] text-gray-300 mt-10">
      <div className="container py-8 md:py-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Contato */}
          <div>
            <h4 className="text-[hsl(var(--green-cta))] font-semibold text-sm uppercase tracking-wider mb-3">
              Contato
            </h4>
            <div className="space-y-2 text-sm">
              <a href="tel:+551146739100" className="flex items-center gap-2 hover:text-white transition-colors">
                <Phone className="w-4 h-4 flex-shrink-0" />
                (11) 4673-9100
              </a>
              <a href="tel:+5511973498801" className="flex items-center gap-2 hover:text-white transition-colors">
                <Phone className="w-4 h-4 flex-shrink-0" />
                (11) 97349-8801
              </a>
              <a href="mailto:contato@giftweb.com.br" className="flex items-center gap-2 hover:text-white transition-colors">
                <Mail className="w-4 h-4 flex-shrink-0" />
                contato@giftweb.com.br
              </a>
            </div>
          </div>

          {/* Endereços */}
          <div>
            <h4 className="text-[hsl(var(--green-cta))] font-semibold text-sm uppercase tracking-wider mb-3">
              Endereços
            </h4>
            <div className="space-y-3 text-sm">
              <div className="flex gap-2">
                <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-white">Matriz</p>
                  <p>R. Xavantes, 100 – Brás, São Paulo – SP</p>
                </div>
              </div>
              <div className="flex gap-2">
                <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-white">Filial</p>
                  <p>R. Maria Marcolina, 280 – Brás, São Paulo – SP</p>
                </div>
              </div>
            </div>
          </div>

          {/* Pagamento */}
          <div>
            <h4 className="text-[hsl(var(--green-cta))] font-semibold text-sm uppercase tracking-wider mb-3">
              Formas de Pagamento
            </h4>
            <div className="flex flex-wrap gap-2">
              {["visa", "mastercard", "amex", "elo", "diners", "jcb", "discover"].map((brand) => (
                <img
                  key={brand}
                  src={`/logos/${brand}.svg`}
                  alt={brand}
                  className="h-7 w-auto opacity-70"
                  loading="lazy"
                />
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-3">Boleto bancário • PIX • Transferência</p>
          </div>
        </div>

        <div className="border-t border-white/10 mt-6 pt-4 text-center text-xs text-gray-500">
          © {new Date().getFullYear()} Gift Web — Todos os direitos reservados
        </div>
      </div>
    </footer>
  );
};

export default CatalogFooter;
