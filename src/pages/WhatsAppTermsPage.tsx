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

const WhatsAppTermsPage = () => (
  <>
    <Helmet>
      <title>Termos de Serviço — WhatsApp | Gift Web Brindes</title>
      <meta
        name="description"
        content="Termos de uso do canal de atendimento da Gift Web Brindes via WhatsApp Business API: finalidade, condutas, responsabilidades e limitações."
      />
      <link rel="canonical" href={`${SITE_URL}/termos-de-servico-whatsapp`} />
    </Helmet>
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <div className="container py-10 md:py-16 max-w-3xl">
          <nav className="text-xs text-muted-foreground mb-8 flex gap-1.5">
            <Link to="/" className="hover:text-foreground transition-colors">Início</Link>
            <span>/</span>
            <span className="text-foreground">Termos de Serviço — WhatsApp</span>
          </nav>

          <h1 className="font-black text-[32px] md:text-[42px] leading-tight text-foreground mb-3">
            Termos de Serviço — <span className="text-highlight">WhatsApp</span>
          </h1>
          <p className="text-muted-foreground text-sm mb-10">Última atualização: maio de 2026</p>

          <p className="text-muted-foreground leading-relaxed mb-8">
            Estes Termos de Serviço regulam o uso do canal de atendimento da <strong className="text-foreground">Gift Web Brindes</strong> via <strong className="text-foreground">WhatsApp Business API</strong>. Ao iniciar uma conversa conosco pelo WhatsApp, você declara ter lido, compreendido e aceito integralmente as condições aqui descritas.
          </p>

          <Section title="1. Identificação do Prestador">
            <p><strong className="text-foreground">Razão social:</strong> Gift Web Brindes Promocionais Ltda.</p>
            <p><strong className="text-foreground">CNPJ:</strong> 00.000.000/0001-00</p>
            <p><strong className="text-foreground">Endereço:</strong> Florianópolis — SC, Brasil</p>
            <p><strong className="text-foreground">Contato:</strong> contato@giftwebbrindes.com.br</p>
          </Section>

          <Section title="2. Finalidade do Canal">
            <p>O canal de WhatsApp da Gift Web Brindes destina-se exclusivamente a:</p>
            <p>• Atendimento comercial e pré-vendas;</p>
            <p>• Solicitação e envio de orçamentos de brindes corporativos personalizados;</p>
            <p>• Acompanhamento de pedidos em produção e entrega;</p>
            <p>• Suporte pós-venda e tira-dúvidas;</p>
            <p>• Comunicações operacionais relativas a contratos vigentes.</p>
          </Section>

          <Section title="3. Horário de Atendimento">
            <p>O atendimento humano ocorre de <strong className="text-foreground">segunda a sexta-feira, das 8h às 18h</strong> (horário de Brasília), exceto feriados nacionais. Mensagens recebidas fora desse horário serão respondidas no próximo dia útil.</p>
          </Section>

          <Section title="4. Condutas Proibidas">
            <p>É expressamente vedado utilizar este canal para:</p>
            <p>• Enviar conteúdo ilícito, ofensivo, discriminatório, difamatório ou que viole direitos de terceiros;</p>
            <p>• Enviar spam, mensagens em massa, correntes ou qualquer prática considerada abusiva;</p>
            <p>• Tentar obter acesso não autorizado aos nossos sistemas;</p>
            <p>• Personificar terceiros ou fornecer informações falsas;</p>
            <p>• Comercializar, revender ou redistribuir os atendimentos prestados;</p>
            <p>• Violar as <a href="https://www.whatsapp.com/legal/business-policy" target="_blank" rel="noopener noreferrer" className="text-highlight hover:underline">Políticas Comerciais do WhatsApp</a> e os Termos da Meta.</p>
            <p>O descumprimento poderá resultar em bloqueio do contato e nas medidas legais cabíveis.</p>
          </Section>

          <Section title="5. Mensagens Automatizadas e Opt-in">
            <p>Algumas respostas podem ser automatizadas (por exemplo, mensagens de boas-vindas e atualizações de pedido). Mensagens promocionais somente serão enviadas mediante autorização expressa (opt-in), podendo ser canceladas a qualquer momento respondendo "SAIR" ou "PARAR".</p>
          </Section>

          <Section title="6. Privacidade e Proteção de Dados">
            <p>O tratamento dos seus dados pessoais nesse canal segue a nossa <Link to="/politica-de-privacidade-whatsapp" className="text-highlight hover:underline">Política de Privacidade — WhatsApp</Link>, em conformidade com a LGPD e as políticas da Meta.</p>
          </Section>

          <Section title="7. Propriedade Intelectual">
            <p>Marcas, logotipos, imagens de produtos, layouts e demais conteúdos enviados pela Gift Web Brindes são protegidos por direitos autorais e/ou marcários. É vedada a reprodução, modificação ou uso comercial sem autorização prévia e expressa.</p>
          </Section>

          <Section title="8. Limitação de Responsabilidade">
            <p>A Gift Web Brindes não se responsabiliza por:</p>
            <p>• Indisponibilidade do WhatsApp ou de serviços operados por terceiros (Meta, operadoras de telefonia, provedores de internet);</p>
            <p>• Atrasos ou falhas de entrega de mensagens decorrentes de problemas técnicos alheios ao nosso controle;</p>
            <p>• Uso indevido do canal por terceiros utilizando o seu número.</p>
            <p>Orçamentos enviados via WhatsApp possuem validade indicada na própria proposta e não constituem contrato de compra e venda até a confirmação formal do pedido.</p>
          </Section>

          <Section title="9. Alterações nos Termos">
            <p>Reservamo-nos o direito de modificar estes Termos a qualquer tempo, sendo a versão atualizada publicada nesta mesma URL com a respectiva data. O uso continuado do canal após alterações implica aceitação dos novos termos.</p>
          </Section>

          <Section title="10. Foro e Legislação Aplicável">
            <p>Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da Comarca de Florianópolis — SC para dirimir quaisquer controvérsias, com renúncia expressa a qualquer outro, por mais privilegiado que seja.</p>
          </Section>

          <div className="mt-10 pt-8 border-t border-border flex flex-wrap gap-4 text-sm">
            <Link to="/politica-de-privacidade-whatsapp" className="text-highlight hover:underline">Política de Privacidade — WhatsApp →</Link>
            <Link to="/exclusao-de-dados" className="text-highlight hover:underline">Exclusão de Dados →</Link>
          </div>
        </div>
      </main>
      <Footer />
      <FloatingWhatsApp />
    </div>
  </>
);

export default WhatsAppTermsPage;
