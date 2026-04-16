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

const TrocasDevolucoesPage = () => (
  <>
    <Helmet>
      <title>Política de Trocas e Devoluções | Gift Web Brindes</title>
      <meta name="description" content="Conheça a política de trocas e devoluções da Gift Web Brindes: prazos, procedimentos para defeitos de fabricação, direito de arrependimento e reembolsos." />
      <link rel="canonical" href={`${SITE_URL}/politica-de-trocas-e-devolucoes`} />
    </Helmet>
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1">
        <div className="container py-10 md:py-16 max-w-3xl">
          <nav className="text-xs text-muted-foreground mb-8 flex gap-1.5">
            <Link to="/" className="hover:text-foreground transition-colors">Início</Link>
            <span>/</span>
            <span className="text-foreground">Política de Trocas e Devoluções</span>
          </nav>

          <h1 className="font-black text-[32px] md:text-[42px] leading-tight text-foreground mb-3">
            Política de <span className="text-highlight">Trocas e Devoluções</span>
          </h1>
          <p className="text-muted-foreground text-sm mb-10">Atualizado em abril de 2026</p>

          <p className="text-muted-foreground leading-relaxed mb-10">
            Na <strong className="text-foreground">Gift Web Brindes</strong>, nosso compromisso é com a total satisfação de nossos clientes e a excelência na entrega de produtos que fortalecem a sua marca. Nossa política de trocas e devoluções é baseada no Código de Defesa do Consumidor e adaptada às particularidades de produtos personalizados.
          </p>

          <Section title="1. Considerações sobre Produtos Personalizados">
            <p>Os itens comercializados pela Gift Web que recebem personalização (logotipos, artes específicas ou gravações) são produzidos exclusivamente sob demanda para o cliente. Por esse motivo, <strong className="text-foreground">não aceitamos devoluções por arrependimento ou desistência</strong> após a aprovação do layout e produção iniciada, uma vez que o produto perde seu valor comercial para revenda.</p>
          </Section>

          <Section title="2. Troca por Defeito de Fabricação ou Erro na Personalização">
            <p>Caso o produto apresente qualquer defeito de fabricação ou divergência em relação ao layout digital aprovado pelo cliente, a Gift Web garante a substituição sem custos adicionais.</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong className="text-foreground">Prazo para reclamação:</strong> O cliente deve comunicar a falha em até <strong className="text-foreground">7 (sete) dias corridos</strong> após o recebimento do pedido.</li>
              <li><strong className="text-foreground">Procedimento:</strong> Envie fotos e vídeos do defeito para o e-mail oficial de atendimento ou WhatsApp de suporte, citando o número da Nota Fiscal.</li>
              <li><strong className="text-foreground">Resolução:</strong> Após a análise técnica (que ocorre em até 5 dias úteis), sendo constatado o erro ou defeito, providenciaremos a reposição dos itens no menor prazo possível de produção.</li>
            </ul>
          </Section>

          <Section title="3. Direito de Arrependimento (Produtos sem Personalização)">
            <p>Para itens adquiridos sem qualquer tipo de personalização, o cliente possui o prazo de <strong className="text-foreground">7 (sete) dias corridos</strong> a contar do recebimento para solicitar a devolução por arrependimento. O produto deve estar em sua embalagem original, sem indícios de uso e acompanhado de Nota Fiscal.</p>
          </Section>

          <Section title="4. Reembolsos e Estornos">
            <p>Caso seja acordado o reembolso (em situações de falta de estoque para reposição de itens defeituosos ou direito de arrependimento em itens lisos):</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong className="text-foreground">Cartão de Crédito:</strong> O estorno será solicitado à administradora do cartão, podendo aparecer em até duas faturas subsequentes.</li>
              <li><strong className="text-foreground">PIX ou Boleto:</strong> O reembolso será feito via transferência bancária para a conta da empresa (CNPJ) ou CPF do comprador em até <strong className="text-foreground">10 dias úteis</strong>.</li>
            </ul>
          </Section>

          <Section title="5. Logística de Devolução">
            <p>O custo de frete para devolução de produtos com defeito comprovado é de inteira responsabilidade da Gift Web Brindes, através de logística reversa ou coleta agendada.</p>
          </Section>

          <Section title="6. Endereços e Identificação">
            <p><strong className="text-foreground">Gift Web Brindes</strong><br />CNPJ: 29.391.838/0001-97</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong className="text-foreground">Matriz (SC):</strong> Rua Cel Marcos Rovaris, 274 – Centro, Içara – SC, CEP: 88820-000.</li>
              <li><strong className="text-foreground">Filial (SP):</strong> Av. Monteiro Lobato, 4550 – Galpão 6 – Setor 7 – Cidade Jardim Cumbica, Guarulhos – SP, CEP: 07180-000.</li>
            </ul>
          </Section>

          <div className="mt-10 pt-8 border-t border-border flex flex-wrap gap-4 text-sm">
            <Link to="/politica-de-privacidade" className="text-highlight hover:underline">Política de Privacidade →</Link>
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

export default TrocasDevolucoesPage;
