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

const DataDeletionPage = () => (
  <>
    <Helmet>
      <title>Exclusão de Dados do Usuário | Gift Web Brindes</title>
      <meta
        name="description"
        content="Instruções para solicitar a exclusão dos seus dados pessoais coletados pela Gift Web Brindes via WhatsApp Business API e demais canais."
      />
      <link rel="canonical" href={`${SITE_URL}/exclusao-de-dados`} />
    </Helmet>
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <div className="container py-10 md:py-16 max-w-3xl">
          <nav className="text-xs text-muted-foreground mb-8 flex gap-1.5">
            <Link to="/" className="hover:text-foreground transition-colors">Início</Link>
            <span>/</span>
            <span className="text-foreground">Exclusão de Dados</span>
          </nav>

          <h1 className="font-black text-[32px] md:text-[42px] leading-tight text-foreground mb-3">
            Exclusão de <span className="text-highlight">Dados do Usuário</span>
          </h1>
          <p className="text-muted-foreground text-sm mb-10">Última atualização: maio de 2026</p>

          <p className="text-muted-foreground leading-relaxed mb-8">
            A <strong className="text-foreground">Gift Web Brindes</strong> respeita o seu direito, garantido pela Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018), de solicitar a exclusão dos dados pessoais que mantemos sobre você, inclusive os coletados por meio do <strong className="text-foreground">WhatsApp Business API</strong> e da nossa integração com a plataforma Meta.
          </p>

          <Section title="Como solicitar a exclusão dos seus dados">
            <p>Para solicitar a exclusão, siga os passos abaixo:</p>
            <p><strong className="text-foreground">1.</strong> Envie um e-mail para <strong className="text-foreground">contato@giftwebbrindes.com.br</strong> com o assunto: <em>"Solicitação de Exclusão de Dados — LGPD"</em>.</p>
            <p><strong className="text-foreground">2.</strong> No corpo do e-mail, informe:</p>
            <p className="pl-4">• Nome completo;</p>
            <p className="pl-4">• Número de telefone utilizado no contato via WhatsApp (com DDD e código do país);</p>
            <p className="pl-4">• E-mail e/ou CNPJ utilizados em pedidos anteriores (se aplicável);</p>
            <p className="pl-4">• Descrição clara do pedido (exclusão total ou parcial dos dados).</p>
            <p><strong className="text-foreground">3.</strong> Para garantir a segurança da solicitação, poderemos solicitar documentos ou informações adicionais que comprovem sua identidade.</p>
          </Section>

          <Section title="Prazo de atendimento">
            <p>Sua solicitação será analisada e respondida em até <strong className="text-foreground">15 (quinze) dias úteis</strong>, contados do recebimento, conforme prevê a LGPD. Em casos que demandem análise mais aprofundada, esse prazo poderá ser estendido, mediante justificativa formal enviada ao seu e-mail.</p>
          </Section>

          <Section title="O que será excluído">
            <p>Atendida a solicitação, removeremos de forma definitiva:</p>
            <p>• Histórico de conversas e mídias trocadas via WhatsApp Business API;</p>
            <p>• Cadastro com nome, telefone, e-mail e endereço;</p>
            <p>• Preferências e demais informações de contato armazenadas em nossos sistemas de atendimento e CRM.</p>
          </Section>

          <Section title="O que pode ser mantido por obrigação legal">
            <p>Conforme permite a LGPD (art. 16), alguns dados poderão ser <strong className="text-foreground">retidos mesmo após a solicitação de exclusão</strong>, exclusivamente para cumprimento de obrigações legais, regulatórias ou para o exercício regular de direitos:</p>
            <p>• <strong className="text-foreground">Documentos fiscais</strong> (notas fiscais, comprovantes de pagamento) — pelo prazo mínimo de 5 anos exigido pela legislação tributária;</p>
            <p>• <strong className="text-foreground">Registros contábeis e contratuais</strong> — pelos prazos previstos em lei;</p>
            <p>• <strong className="text-foreground">Logs de acesso</strong> — quando exigido pelo Marco Civil da Internet (Lei nº 12.965/2014).</p>
            <p>Esses dados ficam armazenados de forma restrita, com acesso limitado, e são descartados ao fim do prazo legal.</p>
          </Section>

          <Section title="Acompanhamento da solicitação">
            <p>Após o envio do e-mail, você receberá um número de protocolo de atendimento. Caso não receba retorno em até 15 dias úteis, ou queira esclarecer dúvidas sobre o processo, entre em contato pelo mesmo e-mail informando o número do protocolo.</p>
          </Section>

          <Section title="Canal alternativo">
            <p>Como alternativa ao e-mail, você também pode formalizar a solicitação pelo nosso WhatsApp oficial, mencionando expressamente que se trata de <em>"Solicitação de Exclusão de Dados — LGPD"</em>. Recomendamos, porém, o uso do e-mail por garantir registro formal e rastreabilidade.</p>
          </Section>

          <Section title="Contato">
            <p><strong className="text-foreground">Razão social:</strong> Gift Web Brindes Promocionais Ltda.</p>
            <p><strong className="text-foreground">CNPJ:</strong> 00.000.000/0001-00</p>
            <p><strong className="text-foreground">E-mail:</strong> contato@giftwebbrindes.com.br</p>
            <p><strong className="text-foreground">WhatsApp:</strong> +55 (48) 99665-2844</p>
            <p><strong className="text-foreground">Endereço:</strong> Florianópolis — SC, Brasil</p>
          </Section>

          <div className="mt-10 pt-8 border-t border-border flex flex-wrap gap-4 text-sm">
            <Link to="/politica-de-privacidade-whatsapp" className="text-highlight hover:underline">Política de Privacidade — WhatsApp →</Link>
            <Link to="/termos-de-servico-whatsapp" className="text-highlight hover:underline">Termos de Serviço — WhatsApp →</Link>
          </div>
        </div>
      </main>
      <Footer />
      <FloatingWhatsApp />
    </div>
  </>
);

export default DataDeletionPage;
