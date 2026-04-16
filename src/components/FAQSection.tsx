import { Helmet } from "react-helmet-async";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "Qual o prazo de entrega dos brindes personalizados?",
    answer:
      "O prazo médio de produção é de 2 a 10 dias úteis após a aprovação da arte. O frete varia conforme a localidade, mas atendemos todo o Brasil com logística própria e parceiros.",
  },
  {
    question: "Qual a quantidade mínima para pedidos?",
    answer:
      "A quantidade mínima varia de acordo com o produto. Em geral, trabalhamos a partir de 50 unidades para a maioria dos itens. Consulte nosso time comercial para quantidades específicas.",
  },
  {
    question: "Como funciona a personalização dos brindes?",
    answer:
      "Após a escolha do produto, nossa equipe de arte desenvolve o layout com a sua marca. Enviamos uma prova digital para aprovação antes de iniciar a produção. As técnicas incluem serigrafia, laser, transfer e impressão UV.",
  },
  {
    question: "Vocês enviam amostras antes do pedido?",
    answer:
      "Sim, podemos enviar amostras de produtos selecionados. Consulte disponibilidade e condições com nosso time comercial via WhatsApp.",
  },
  {
    question: "Quais formas de pagamento são aceitas?",
    answer:
      "Aceitamos boleto bancário, transferência (PIX), cartão de crédito e condições especiais para pedidos recorrentes. Faturamento para CNPJ com prazo sob consulta.",
  },
  {
    question: "Vocês atendem em todo o Brasil?",
    answer:
      "Sim! Temos matriz em Santa Catarina e filial em São Paulo, com logística para atender empresas em todo o território nacional.",
  },
];

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.answer,
    },
  })),
};

const FAQSection = () => (
  <section className="py-14 md:py-20 bg-background">
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>
    </Helmet>
    <div className="container max-w-[800px] mx-auto">
      <div className="text-center mb-10">
        <h2 className="text-foreground font-extrabold text-[28px] md:text-[32px]">
          Perguntas <span className="text-highlight">Frequentes</span>
        </h2>
        <p className="text-muted-foreground text-sm mt-2">
          Tire suas dúvidas sobre brindes corporativos personalizados
        </p>
      </div>

      <Accordion type="single" collapsible className="space-y-3">
        {faqs.map((faq, i) => (
          <AccordionItem
            key={i}
            value={`faq-${i}`}
            className="border border-border rounded-xl px-5 bg-card"
          >
            <AccordionTrigger className="text-left text-[15px] font-semibold text-foreground py-4 hover:no-underline">
              {faq.question}
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground text-[14px] leading-relaxed pb-4">
              {faq.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  </section>
);

export default FAQSection;
