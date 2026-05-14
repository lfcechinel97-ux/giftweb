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

const WhatsAppPrivacyPage = () => (
  <>
    <Helmet>
      <title>Política de Privacidade — WhatsApp | Gift Web Brindes</title>
      <meta
        name="description"
        content="Política de privacidade aplicável ao atendimento da Gift Web Brindes via WhatsApp Business API: dados coletados, finalidade, retenção e direitos do titular."
      />
      <link rel="canonical" href={`${SITE_URL}/politica-de-privacidade-whatsapp`} />
    </Helmet>
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <div className="container py-10 md:py-16 max-w-3xl">
          <nav className="text-xs text-muted-foreground mb-8 flex gap-1.5">
            <Link to="/" className="hover:text-foreground transition-colors">Início</Link>
            <span>/</span>
            <span className="text-foreground">Política de Privacidade — WhatsApp</span>
          </nav>

          <h1 className="font-black text-[32px] md:text-[42px] leading-tight text-foreground mb-3">
            Política de Privacidade — <span className="text-highlight">WhatsApp</span>
          </h1>
          <p className="text-muted-foreground text-sm mb-10">Última atualização: maio de 2026</p>

          <p className="text-muted-foreground leading-relaxed mb-8">
            Esta Política de Privacidade descreve como a <strong className="text-foreground">Gift Web Brindes</strong> ("nós") coleta, utiliza, armazena e protege os dados pessoais dos usuários ("você") que entram em contato conosco por meio do <strong className="text-foreground">WhatsApp Business API</strong>, em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD) e as políticas da Meta Platforms, Inc.
          </p>

          <Section title="1. Identificação do Controlador">
            <p><strong className="text-foreground">Razão social:</strong> Gift Web Brindes Promocionais Ltda.</p>
            <p><strong className="text-foreground">CNPJ:</strong> 00.000.000/0001-00</p>
            <p><strong className="text-foreground">Endereço:</strong> Florianópolis — SC, Brasil</p>
            <p><strong className="text-foreground">E-mail de contato:</strong> contato@giftwebbrindes.com.br</p>
            <p><strong className="text-foreground">Site:</strong> www.giftwebbrindes.com.br</p>
          </Section>

          <Section title="2. Dados Coletados via WhatsApp">
            <p>Quando você inicia uma conversa conosco pelo WhatsApp Business API, podemos coletar:</p>
            <p><strong className="text-foreground">• Dados de identificação:</strong> número de telefone, nome de exibição do WhatsApp e foto de perfil (quando disponíveis).</p>
            <p><strong className="text-foreground">• Conteúdo das mensagens:</strong> textos, imagens, documentos, áudios, vídeos e outros arquivos enviados por você durante o atendimento.</p>
            <p><strong className="text-foreground">• Metadados da conversa:</strong> data, horário, status de entrega e leitura das mensagens.</p>
            <p><strong className="text-foreground">• Dados comerciais voluntários:</strong> nome completo, e-mail, CNPJ, endereço de entrega e demais informações fornecidas para emissão de orçamentos e pedidos.</p>
          </Section>

          <Section title="3. Finalidade do Tratamento">
            <p>Utilizamos seus dados exclusivamente para:</p>
            <p>• Prestar atendimento comercial e responder a dúvidas;</p>
            <p>• Elaborar orçamentos personalizados de brindes corporativos;</p>
            <p>• Processar pedidos, pagamentos e logística de entrega;</p>
            <p>• Enviar atualizações relacionadas ao seu pedido (status de produção, envio e entrega);</p>
            <p>• Cumprir obrigações legais, regulatórias e fiscais;</p>
            <p>• Aprimorar a qualidade do nosso atendimento.</p>
          </Section>

          <Section title="4. Base Legal (LGPD)">
            <p>O tratamento dos seus dados pessoais ocorre com fundamento em uma das seguintes bases legais previstas no art. 7º da LGPD:</p>
            <p>• <strong className="text-foreground">Consentimento</strong> — ao iniciar contato voluntariamente pelo WhatsApp;</p>
            <p>• <strong className="text-foreground">Execução de contrato</strong> — para emissão de orçamentos e pedidos;</p>
            <p>• <strong className="text-foreground">Cumprimento de obrigação legal</strong> — para emissão de notas fiscais e demais exigências;</p>
            <p>• <strong className="text-foreground">Legítimo interesse</strong> — para melhoria do atendimento, sempre respeitando seus direitos fundamentais.</p>
          </Section>

          <Section title="5. Compartilhamento de Dados">
            <p>Não vendemos, alugamos ou comercializamos seus dados pessoais. Podemos compartilhá-los apenas com:</p>
            <p>• <strong className="text-foreground">Meta Platforms, Inc.</strong> — operadora do WhatsApp Business API, conforme as próprias políticas da Meta;</p>
            <p>• <strong className="text-foreground">Provedores de infraestrutura</strong> — hospedagem em nuvem, CRM e ferramentas de atendimento, todos sujeitos a obrigações contratuais de confidencialidade;</p>
            <p>• <strong className="text-foreground">Transportadoras e operadores logísticos</strong> — somente os dados necessários à entrega;</p>
            <p>• <strong className="text-foreground">Autoridades públicas</strong> — quando exigido por lei ou ordem judicial.</p>
          </Section>

          <Section title="6. Retenção de Dados">
            <p>Mantemos os dados de conversa pelo tempo necessário ao cumprimento das finalidades descritas, observando os seguintes prazos:</p>
            <p>• <strong className="text-foreground">Conversas ativas:</strong> durante todo o período de relacionamento comercial;</p>
            <p>• <strong className="text-foreground">Conversas inativas:</strong> até 12 meses após o último contato;</p>
            <p>• <strong className="text-foreground">Dados de pedidos e notas fiscais:</strong> mínimo de 5 anos, conforme legislação fiscal e tributária aplicável.</p>
            <p>Após esses prazos, os dados são anonimizados ou excluídos de forma segura.</p>
          </Section>

          <Section title="7. Segurança dos Dados">
            <p>Adotamos medidas técnicas e administrativas para proteger seus dados contra acesso não autorizado, perda, alteração ou divulgação indevida, incluindo controle de acesso, criptografia em trânsito (TLS/SSL) e backups periódicos. As mensagens trocadas via WhatsApp utilizam a criptografia ponta-a-ponta padrão da plataforma Meta.</p>
          </Section>

          <Section title="8. Seus Direitos como Titular">
            <p>Nos termos da LGPD, você tem direito a, a qualquer momento:</p>
            <p>• Confirmar a existência de tratamento dos seus dados;</p>
            <p>• Acessar, corrigir, atualizar ou completar seus dados;</p>
            <p>• Solicitar a anonimização, bloqueio ou eliminação de dados desnecessários;</p>
            <p>• Solicitar a portabilidade a outro fornecedor;</p>
            <p>• Revogar o consentimento;</p>
            <p>• Opor-se a tratamento realizado com base em legítimo interesse.</p>
            <p>Para exercer qualquer destes direitos, envie sua solicitação para <strong className="text-foreground">contato@giftwebbrindes.com.br</strong> ou siga as instruções na nossa página de <Link to="/exclusao-de-dados" className="text-highlight hover:underline">Exclusão de Dados do Usuário</Link>.</p>
          </Section>

          <Section title="9. Mensagens de Marketing (Opt-in)">
            <p>Não enviamos mensagens promocionais via WhatsApp sem o seu consentimento expresso (opt-in). Caso você tenha autorizado o recebimento, poderá cancelar a qualquer momento respondendo "SAIR" ou "PARAR" à mensagem, sem qualquer custo.</p>
          </Section>

          <Section title="10. Alterações nesta Política">
            <p>Esta Política poderá ser atualizada a qualquer momento para refletir mudanças legais, operacionais ou tecnológicas. A versão vigente estará sempre disponível nesta URL, com a respectiva data de atualização.</p>
          </Section>

          <Section title="11. Contato e Encarregado (DPO)">
            <p>Para dúvidas sobre esta Política ou sobre o tratamento dos seus dados, entre em contato:</p>
            <p><strong className="text-foreground">E-mail:</strong> contato@giftwebbrindes.com.br</p>
            <p><strong className="text-foreground">WhatsApp:</strong> +55 (48) 99665-2844</p>
          </Section>

          <div className="mt-10 pt-8 border-t border-border flex flex-wrap gap-4 text-sm">
            <Link to="/termos-de-servico-whatsapp" className="text-highlight hover:underline">Termos de Serviço — WhatsApp →</Link>
            <Link to="/exclusao-de-dados" className="text-highlight hover:underline">Exclusão de Dados →</Link>
          </div>
        </div>
      </main>
      <Footer />
      <FloatingWhatsApp />
    </div>
  </>
);

export default WhatsAppPrivacyPage;
