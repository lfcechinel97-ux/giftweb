## Páginas para o app WhatsApp Business API (Meta)

A Meta exige 3 URLs públicas, acessíveis sem login, em domínio próprio, com conteúdo claro sobre tratamento de dados. Hoje o site já tem Política de Privacidade e Termos de Uso, mas:

- ambas falam só do e-commerce, sem citar **WhatsApp Business API**, mensagens ou dados de conversas;
- **não existe** página de instruções de exclusão de dados (obrigatória pela Meta).

### O que vou criar

1. **`/politica-de-privacidade-whatsapp`** — `WhatsAppPrivacyPage.tsx`
   - Específica para o app WhatsApp.
   - Cobre: dados coletados via WhatsApp (telefone, nome, mensagens, mídias), finalidade (atendimento comercial, orçamentos, suporte), base legal LGPD, compartilhamento (apenas Meta/WhatsApp como operador), retenção, direitos do titular, contato do DPO.

2. **`/termos-de-servico-whatsapp`** — `WhatsAppTermsPage.tsx`
   - Termos de uso do canal de atendimento via WhatsApp.
   - Cobre: finalidade do canal, horário, condutas proibidas, propriedade intelectual, limitação de responsabilidade, alterações, foro.

3. **`/exclusao-de-dados`** — `DataDeletionPage.tsx`
   - Instruções passo a passo para o usuário solicitar exclusão.
   - Inclui: e-mail de contato (`contato@giftwebbrindes.com.br` — confirmar), formato da solicitação, prazo de resposta (até 15 dias conforme LGPD), o que é apagado, como acompanhar.
   - Padrão Meta: página estática, sem login, sem JS obrigatório para ler o conteúdo.

### Padrões Meta seguidos

- URLs estáveis, em domínio próprio (`giftwebbrindes.com.br`).
- Conteúdo em português, acessível sem autenticação.
- Identificação clara da empresa (razão social, CNPJ, endereço, contato).
- Data de "última atualização" visível.
- Menção explícita ao **WhatsApp Business API** e ao uso de dados de mensagens.
- Canal de contato funcional para exercício de direitos.

### Implementação técnica

- 3 arquivos novos em `src/pages/` seguindo o mesmo layout de `PrivacyPage.tsx` (Helmet com título/description/canonical, Header, Footer, FloatingWhatsApp, breadcrumb).
- 3 rotas novas em `src/App.tsx`.
- Adicionar as 3 URLs no `public/sitemap.xml`.
- Sem mudanças de backend, sem mudanças de design system.

### URLs finais entregues

- `https://www.giftwebbrindes.com.br/politica-de-privacidade-whatsapp`
- `https://www.giftwebbrindes.com.br/termos-de-servico-whatsapp`
- `https://www.giftwebbrindes.com.br/exclusao-de-dados`

### Dado que preciso confirmar antes de implementar

Quais informações oficiais devo usar nas páginas?
- **Razão social + CNPJ** da Gift Web
- **Endereço completo**
- **E-mail de contato** para LGPD / exclusão de dados (ex.: `contato@giftwebbrindes.com.br` ou `dpo@...`)

Se preferir, posso usar placeholders (`[RAZÃO SOCIAL]`, `[CNPJ]`, etc.) e você ajusta depois — me diga qual caminho prefere.
