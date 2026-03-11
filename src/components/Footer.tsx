import { Instagram, MessageCircle } from "lucide-react";

const Footer = () => (
  <footer className="bg-navy-dark text-muted-foreground border-t border-border">
    <div className="container py-12">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        {/* Col 1 */}
        <div>
          <div className="flex items-baseline gap-0.5 mb-4">
            <span className="text-xl font-extrabold text-foreground">Gift Web</span>
            <span className="text-sm font-semibold text-green-cta ml-1">brindes</span>
          </div>
          <p className="text-sm mb-2">
            <MessageCircle size={14} className="inline mr-1" />
            (48) 99652-5312
          </p>
          <p className="text-sm">contato@giftweb.com.br</p>
        </div>

        {/* Col 2 */}
        <div>
          <h4 className="font-semibold mb-3 text-sm uppercase tracking-wider text-muted-foreground">Ajuda</h4>
          <ul className="space-y-2 text-sm">
            <li><a href="#" className="hover:text-green-cta transition-colors">Como comprar</a></li>
            <li><a href="#" className="hover:text-green-cta transition-colors">Prazo de entrega</a></li>
            <li><a href="#" className="hover:text-green-cta transition-colors">Política de troca</a></li>
            <li><a href="#" className="hover:text-green-cta transition-colors">FAQ</a></li>
          </ul>
        </div>

        {/* Col 3 */}
        <div>
          <h4 className="font-semibold mb-3 text-sm uppercase tracking-wider text-muted-foreground">Institucional</h4>
          <ul className="space-y-2 text-sm">
            <li><a href="#" className="hover:text-green-cta transition-colors">Sobre nós</a></li>
            <li><a href="#" className="hover:text-green-cta transition-colors">Termos de uso</a></li>
            <li><a href="#" className="hover:text-green-cta transition-colors">Privacidade</a></li>
          </ul>
        </div>

        {/* Col 4 */}
        <div>
          <h4 className="font-semibold mb-3 text-sm uppercase tracking-wider text-muted-foreground">Redes sociais</h4>
          <div className="flex gap-3">
            <a href="#" className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center hover:border-green-cta transition-colors text-foreground">
              <Instagram size={18} strokeWidth={1.5} />
            </a>
            <a href="https://wa.me/5548996525312" target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center hover:border-green-cta transition-colors text-foreground">
              <MessageCircle size={18} strokeWidth={1.5} />
            </a>
          </div>
        </div>
      </div>
    </div>

    <div className="border-t border-border">
      <div className="container py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>CNPJ: 00.000.000/0001-00</span>
        <span>© {new Date().getFullYear()} Gift Web Brindes. Todos os direitos reservados.</span>
      </div>
    </div>
  </footer>
);

export default Footer;
