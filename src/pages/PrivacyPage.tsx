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

const PrivacyPage = () => (
  <>
    <Helmet>
      <title>Política de Privacidade | Gift Web Brindes</title>
      <meta name="description" content="Conheça a política de privacidade da Gift Web Brindes e saiba como seus dados são protegidos." />
      <link rel="canonical" href={`${SITE_URL}/politica-de-privacidade`} />
    </Helmet>
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <div className="container py-10 md:py-16 max-w-3xl">
          <nav className="text-xs text-muted-foreground mb-8 flex gap-1.5">
            <Link to="/" className="hover:text-foreground transition-colors">Início</Link>
            <span>/</span>
            <span className="text-foreground">Política de Privacidade</span>
          </nav>

          <h1 className="font-black text-[32px] md:text-[42px] leading-tight text-foreground mb-3">
            Política de <span className="text-highlight">Privacidade</span>
          </h1>
          <p className="text-muted-foreground text-sm mb-10">Atualizado em março de 2025</p>

          <p className="text-muted-foreground leading-relaxed mb-8">
            A <strong className="text-foreground">Gift Web</strong> tem uma grande preocupação com a segurança de seus dados. Nosso compromisso é assegurar a privacidade de cada cliente. O sigilo de suas informações é muito importante. Desta forma, utilizamos neste site o Certificado de Segurança de alto nível.
          </p>
          <p className="text-muted-foreground leading-relaxed mb-8">
            O processo de segurança para a transferência de suas informações consiste na criptografia de seus dados. Eles são transmitidos e só podem ser decodificados no servidor de Internet da Gift Web. Isto garante a segurança na transmissão dos dados durante o processo de compra.
          </p>
          <p className="text-muted-foreground leading-relaxed mb-10">
            Para a identificação dos clientes Gift Web, são utilizados o usuário de cliente (obtido na primeira compra) em conjunto com o e-mail ou CPF. É muito importante que você não forneça seus dados a ninguém.
          </p>

          <Section title="Política de Privacidade">
            <p>A política de privacidade estabelece os termos e condições em que suas informações/dados pessoais poderão ser utilizadas. A Gift Web tem o compromisso de proteger sua privacidade. Por isso, todas as suas informações são protegidas por senha. Para a sua segurança e privacidade, mantenha sua senha em sigilo.</p>
            <p>Porém, a Gift Web poderá, caso seja necessário, modificar a presente política para adaptá-la às alterações legislativas ou jurisprudenciais, ou aquelas relativas às práticas comerciais. Em qualquer caso, as mudanças introduzidas serão publicadas por meio desta página com uma antecedência razoável à sua colocação em prática.</p>
          </Section>

          <Section title="Dados Pessoais">
            <p>A expressão "dados pessoais" significa informações tais como: nome; endereço; endereço de e-mail; provedor de serviços de internet; telefone; entre outras informações pessoais que possam ser fornecidas por você ou coletadas sobre você, de acordo com a legislação local aplicável.</p>
            <p>Os dados pessoais solicitados pela Gift Web serão objeto de tratamento automatizado, sendo incorporados aos correspondentes registros eletrônicos de dados pessoais, dos quais a Gift Web será titular e responsável. Esses dados são necessários para a realização de um pedido de compras, para a participação em promoções ou qualquer outra ação de Marketing oferecida pelo site.</p>
            <p>Ao se cadastrar, o Cliente e/ou Usuário aceita automaticamente a política de privacidade da Gift Web e se responsabiliza pela veracidade dos seus dados pessoais fornecidos.</p>
          </Section>

          <Section title="Suas Informações">
            <p>Havendo solicitação formal, por qualquer Autoridade Pública ou Judicial devidamente fundamentada, o Cliente e/ou Usuário autoriza expressamente a Gift Web a encaminhar os dados cadastrais solicitados, independente de notificação prévia.</p>
            <p>O cliente poderá, a qualquer tempo, solicitar à Gift Web a exclusão do seu cadastro, assim não receberá mais informações da empresa, seus produtos e serviços.</p>
          </Section>

          <Section title="Compartilhamento de Informações">
            <p>A segurança de suas informações é muito importante para a Gift Web. São compartilhadas com alguns parceiros apenas as informações necessárias para a viabilização de certos serviços, como por exemplo ações de marketing. Este compartilhamento é feito sempre com o compromisso de respeito a esta política de privacidade.</p>
          </Section>

          <Section title="Certificado de Segurança">
            <p>A Gift Web tem adotado os níveis legalmente requeridos quanto à segurança na proteção de dados, e procura instalar todos os meios e medidas adicionais para evitar a perda, mau uso, alteração, acesso não autorizado ou subtração indevida destes dados pessoais recolhidos.</p>
            <p>Utiliza atualmente em seu site o Certificado de Segurança de nível superior, que garante a integridade e a confidencialidade dos dados durante a sua transmissão. Não obstante, o Cliente e/ou Usuário deve estar ciente de que as medidas de segurança relativas à Internet não são integralmente infalíveis.</p>
          </Section>

          <Section title="Compra Segura – Meios de Pagamento">
            <p>Todas as transações de pagamento são executadas com a tecnologia SSL (Secure Socket Layer), garantindo que todos os dados pessoais do cliente, tais como endereço de entrega, dados de cartão de crédito e histórico de pedidos, jamais sejam divulgados. Além disso, essa tecnologia visa impedir que as informações sejam transmitidas ou acessadas por terceiros.</p>
          </Section>

          <Section title="Coleta de Dados">
            <p>Visando melhorar a comunicação com seus clientes, a Gift Web recebe uma notificação quando seus e-mails são abertos, caso esta funcionalidade esteja ativa no computador do cliente. Também recebe, automaticamente, informações de dispositivos que acessam seu site, somando informações sobre interações dos usuários.</p>
          </Section>

          <Section title="Cookies">
            <p>Gift Web coleta informações através de cookies para controle interno de audiência e de navegação. Utilizamos cookies para guardar informações da sua sacola de compras, o que facilita e agiliza sua compra. A aceitação dos cookies pode ser livremente alterada na configuração de seu navegador.</p>
            <p>Ao deixar um comentário no site, você poderá optar por salvar seu nome, e-mail e site nos cookies por até um ano. Cookies de login são mantidos por dois dias e cookies de opções de tela por um ano.</p>
          </Section>

          <Section title="Tipos de Cookies que Usamos">
            <p><strong className="text-foreground">Essencial:</strong> Permitem manter as sessões do usuário e prevenir quaisquer ameaças à segurança. Não coletam informações pessoais.</p>
            <p><strong className="text-foreground">Estatísticas:</strong> Armazenam informações como número de visitantes e páginas visualizadas, ajudando a compreender o desempenho do site. Utilizamos o Google Analytics.</p>
            <p><strong className="text-foreground">Marketing:</strong> Usados para personalizar anúncios exibidos a você e acompanhar a eficiência de campanhas publicitárias.</p>
            <p><strong className="text-foreground">Funcionais:</strong> Auxiliam funcionalidades não essenciais, como incorporação de vídeos ou compartilhamento em redes sociais.</p>
          </Section>

          <Section title="Com Quem Partilhamos Seus Dados">
            <p>Não compartilhamos seus dados com terceiros, exceto quando necessário para viabilização de serviços específicos, conforme descrito na seção de Compartilhamento de Informações.</p>
          </Section>

          <Section title="Por Quanto Tempo Mantemos Seus Dados">
            <p>Se você deixar um comentário, o comentário e seus metadados são conservados indefinidamente. Para usuários registrados, guardamos as informações pessoais fornecidas no perfil. Todos os usuários podem ver, editar ou excluir suas informações pessoais a qualquer momento.</p>
          </Section>

          <Section title="Quais os Seus Direitos Sobre Seus Dados">
            <p>Você pode solicitar um arquivo exportado dos dados pessoais que mantemos sobre você, inclusive quaisquer dados que nos tenha fornecido. Também pode solicitar que removamos qualquer dado pessoal que mantemos sobre você. Para solicitar, utilize nosso formulário de contato e retornaremos em até 28 dias.</p>
          </Section>

          <Section title="Propriedade Intelectual">
            <p>As imagens e textos expostos no site da Gift Web são de propriedade da empresa, protegidos por registro e/ou contrato devidamente firmado entre as partes. É expressamente proibida a cópia, reprodução e/ou modificação destas imagens e/ou textos para uso comercial.</p>
          </Section>

          <div className="mt-10 pt-8 border-t border-border flex flex-wrap gap-4 text-sm">
            <Link to="/termos-de-uso" className="text-highlight hover:underline">Termos de Uso →</Link>
            <Link to="/seguranca" className="text-highlight hover:underline">Segurança →</Link>
          </div>
        </div>
      </main>
      <Footer />
      <FloatingWhatsApp />
    </div>
  </>
);

export default PrivacyPage;
