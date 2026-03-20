import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FloatingWhatsApp from "@/components/FloatingWhatsApp";
import { SITE_URL } from "@/config/site";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mb-8">
    <h2 className="text-xl font-bold text-foreground mb-3">{title}</h2>
    <div className="text-muted-foreground leading-relaxed space-y-3">{children}</div>
  </div>
);

const TermsPage = () => (
  <>
    <Helmet>
      <title>Termos de Uso | Gift Web Brindes</title>
      <meta name="description" content="Conheça os termos de uso do site da Gift Web Brindes." />
      <link rel="canonical" href={`${SITE_URL}/termos-de-uso`} />
    </Helmet>
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <div className="container py-10 md:py-16 max-w-3xl">
          <nav className="text-xs text-muted-foreground mb-8 flex gap-1.5">
            <Link to="/" className="hover:text-foreground transition-colors">Início</Link>
            <span>/</span>
            <span className="text-foreground">Termos de Uso</span>
          </nav>

          <h1 className="font-black text-[32px] md:text-[42px] leading-tight text-foreground mb-3">
            Termos de <span className="text-highlight">Uso</span>
          </h1>
          <p className="text-muted-foreground text-sm mb-10">Atualizado em março de 2025</p>

          <Section title="Restrições Relativas ao Uso de Conteúdo">
            <p>Este site é de propriedade e operação da <strong className="text-foreground">Gift Web</strong>.</p>
            <p>Todo o conteúdo presente neste site, bem como em quaisquer outros domínios pertencentes, operados, licenciados ou administrados pela Gift Web, está protegido por direitos autorais. É terminantemente proibida a cópia, reprodução, publicação, envio, transmissão ou redistribuição de qualquer material, salvo quando expressamente autorizado para uso pessoal e não comercial, mantendo-se inalterados todos os avisos de direitos autorais e demais avisos de propriedade intelectual.</p>
            <p>Qualquer modificação do conteúdo ou uso para fins que não sejam pessoais constitui violação dos direitos autorais e demais direitos legais.</p>
            <p>Para utilizar qualquer conteúdo do site além do permitido — incluindo reprodução, redistribuição ou criação de links para páginas internas diferentes da página inicial — é obrigatório obter autorização prévia da Gift Web.</p>
            <p>É estritamente proibido utilizar o conteúdo deste site em outros sites, redes ou plataformas, salvo mediante autorização formal. Todas as marcas, nomes comerciais e produtos mencionados são propriedade da Gift Web e/ou de seus fabricantes.</p>
          </Section>

          <Section title="Links para Sites de Terceiros">
            <p>Durante a navegação, é possível encontrar links que direcionam para páginas externas, não pertencentes à Gift Web.</p>
            <p>Esses links são fornecidos apenas para fins informativos. A Gift Web não se responsabiliza pela atualização, veracidade ou manutenção dos conteúdos disponibilizados nesses sites de terceiros.</p>
            <p>Além disso, a presença de links não implica qualquer aprovação, afiliação ou responsabilidade da Gift Web em relação aos produtos, serviços ou conteúdos desses domínios externos.</p>
          </Section>

          <Section title="Limitação de Responsabilidade">
            <p>Em nenhuma circunstância, incluindo eventuais casos de negligência, a Gift Web poderá ser responsabilizada por quaisquer danos diretos, indiretos, especiais, punitivos ou consequenciais derivados do uso ou da impossibilidade de uso dos conteúdos do site, mesmo que tenha sido previamente alertada sobre a possibilidade de tais danos.</p>
            <p>Algumas legislações podem não permitir a limitação de responsabilidade para certos tipos de danos, portanto, essas limitações podem não se aplicar a todos os usuários.</p>
            <p>Independentemente da situação, a responsabilidade da Gift Web estará sempre limitada ao valor total, caso existente, pago pelo usuário para acesso ao site.</p>
          </Section>

          <Section title="Direitos Autorais">
            <p>O uso deste site implica na aceitação plena e irrestrita de todos os termos aqui estabelecidos.</p>
          </Section>

          <div className="mt-10 pt-8 border-t border-border flex flex-wrap gap-4 text-sm">
            <Link to="/politica-de-privacidade" className="text-highlight hover:underline">Política de Privacidade →</Link>
            <Link to="/seguranca" className="text-highlight hover:underline">Segurança →</Link>
          </div>
        </div>
      </main>
      <Footer />
      <FloatingWhatsApp />
    </div>
  </>
);

export default TermsPage;
