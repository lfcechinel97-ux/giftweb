import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FloatingWhatsApp from "@/components/FloatingWhatsApp";
import { SITE_URL } from "@/config/site";

const SecurityPage = () => (
  <>
    <Helmet>
      <title>Segurança | Gift Web Brindes</title>
      <meta name="description" content="Saiba como a Gift Web garante a segurança e privacidade dos seus dados." />
      <link rel="canonical" href={`${SITE_URL}/seguranca`} />
    </Helmet>
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <div className="container py-10 md:py-16 max-w-3xl">
          <nav className="text-xs text-muted-foreground mb-8 flex gap-1.5">
            <Link to="/" className="hover:text-foreground transition-colors">Início</Link>
            <span>/</span>
            <span className="text-foreground">Segurança</span>
          </nav>

          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-highlight/10 flex items-center justify-center">
              <ShieldCheck className="text-highlight" size={20} />
            </div>
            <h1 className="font-black text-[32px] md:text-[42px] leading-tight text-foreground">
              <span className="text-highlight">Segurança</span>
            </h1>
          </div>
          <p className="text-muted-foreground text-sm mb-10">Atualizado em março de 2026</p>

          <p className="text-muted-foreground leading-relaxed mb-6">
            <strong className="text-foreground">Gift Web</strong> garante segurança e privacidade de identidade aos internautas que fazem compras na loja virtual.
          </p>
          <p className="text-muted-foreground leading-relaxed mb-6">
            Dados cadastrados como nome, endereço e número de cartão de crédito são protegidos por sistemas avançados de criptografia enquanto são enviados, e mantidos em sigilo em servidores seguros da empresa.
          </p>
          <p className="text-muted-foreground leading-relaxed mb-10">
            O site Gift Web tem adotado os níveis legalmente requeridos quanto à segurança na proteção de dados, tendo instalado todos os meios e medidas técnicas ao seu alcance para evitar a perda, mau uso, alteração, acesso não autorizado ou subtração indevida dos Dados Pessoais recolhidos.
          </p>

          <div className="grid sm:grid-cols-2 gap-4 mb-10">
            {[
              { title: "Criptografia SSL", desc: "Todos os dados transmitidos são criptografados com tecnologia SSL de alto nível." },
              { title: "Servidores Seguros", desc: "Suas informações são mantidas em sigilo em servidores com proteção avançada." },
              { title: "Certificado Digital", desc: "Nosso certificado de segurança comprova a autenticidade e integridade do site." },
              { title: "Dados Protegidos", desc: "Informações pessoais jamais são divulgadas ou acessadas por terceiros sem autorização." },
            ].map((item) => (
              <div key={item.title} className="p-5 rounded-xl border border-border bg-card">
                <h3 className="font-semibold text-foreground mb-1">{item.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="bg-card border border-border rounded-xl p-6 space-y-4 text-muted-foreground leading-relaxed text-sm">
            <p>Não obstante, o usuário deve estar ciente de que as medidas de segurança relativas à internet não são integralmente infalíveis. Gift Web reserva-se o direito de modificar a presente política para adaptá-la a alterações legislativas ou jurisprudências, ou aquelas relativas às práticas comerciais.</p>
            <p>Em qualquer caso, Gift Web anunciará no site, por meio desta página, as mudanças introduzidas com uma antecedência razoável à sua colocação em prática.</p>
            <p>Os Usuários poderão exercer os direitos de acesso, cancelamento, retificação e oposição, bem como têm reconhecido o direito de obterem informações contatando a Gift Web.</p>
          </div>

          <div className="mt-10 pt-8 border-t border-border flex flex-wrap gap-4 text-sm">
            <Link to="/politica-de-privacidade" className="text-highlight hover:underline">Política de Privacidade →</Link>
            <Link to="/termos-de-uso" className="text-highlight hover:underline">Termos de Uso →</Link>
          </div>
        </div>
      </main>
      <Footer />
      <FloatingWhatsApp />
    </div>
  </>
);

export default SecurityPage;
