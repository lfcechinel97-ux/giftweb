

# Auditoria Completa — Performance, UX, SEO e GEO

---

## 1. PERFORMANCE

### Problemas encontrados

**A. Sem code-splitting / lazy loading de rotas**
- Todas as páginas (Index, ProductDetail, AdminSync, AdminProducts, etc.) são importadas estaticamente no `App.tsx`. O bundle inicial carrega TODO o código, incluindo o admin inteiro.
- **Impacto LCP**: Bundle JS maior = mais tempo para first paint.

**B. Fonte Google Fonts bloqueante**
- `index.css` importa Inter via `@import url(...)` dentro do CSS. Isso é render-blocking — o browser precisa baixar o CSS, parsear, encontrar o @import, e só então baixar a fonte.
- **Impacto LCP/FID**: atraso de 200-500ms dependendo da rede.

**C. Imagens sem dimensões explícitas (CLS)**
- Hero carousel: `<img>` sem `width`/`height` → layout shift quando a imagem carrega.
- ProductCard: `aspect-square` no container ajuda, mas a imagem em si não tem dimensões.
- CategoriesSection: imagens de categoria sem dimensões.
- ClientsSection: logos sem `loading="lazy"`.
- TrustSection: posts do Instagram sem `loading="lazy"`.
- TestimonialsSection: fotos de avatar vêm de `pravatar.cc` — domínio externo sem preconnect.

**D. Dependências pesadas não utilizadas**
- `recharts` (±200KB gzipped) — só usado no admin, mas carregado no bundle principal.
- `embla-carousel-react` — importado mas carousel do hero é manual.
- `react-day-picker` + `date-fns` — provavelmente só admin.
- `next-themes` — importado mas sem dark mode implementado (não há toggle).
- `react-resizable-panels` — provavelmente não usado.
- `input-otp` — provavelmente não usado.

**E. Inline styles excessivos**
- Muitos componentes usam `onMouseEnter/onMouseLeave` para manipular `style` diretamente (CategoriesSection, BestSellersSection, TrustSection, ClientsSection). Isso força reflows e é menos eficiente que CSS puro `:hover`.

**F. Múltiplos setInterval simultâneos na homepage**
- Hero carousel: `setInterval(7000)`
- CategoriesSection mobile: `setInterval(2500)`
- ClientsSection: `setInterval(3000)`
- TestimonialsSection: `setInterval(9000)`
- Todos rodando simultaneamente, mesmo fora da viewport.

### Correções propostas

1. **Lazy load de rotas**: Usar `React.lazy()` + `Suspense` no `App.tsx` para todas as páginas, especialmente admin.
2. **Preload da fonte**: Mover Google Fonts para `<link rel="preconnect">` + `<link rel="preload">` no `index.html` em vez de `@import` no CSS.
3. **Adicionar `width`/`height`** em todas as `<img>` para evitar CLS.
4. **Lazy load** em imagens do ClientsSection, TrustSection e TestimonialsSection.
5. **Substituir inline style manipulation** por classes CSS com `:hover`.
6. **Pausar intervals** quando componentes estão fora da viewport (já têm `useInView`, mas não pausam os timers).

---

## 2. UX (Experiência do Usuário)

### Problemas encontrados

**A. Navegação**
- Mega-menu desktop (720px fixo) pode sair da tela em viewports < 1024px.
- No mobile, fechar o menu requer clicar no X ou em um link — não há "tap fora para fechar".
- Breadcrumbs não existem na homepage nem nas páginas de categoria (existem no ProductDetail).

**B. Responsividade**
- Hero section: filtro + carousel lado a lado em `lg:`. Entre 768-1024px, o layout pode ficar apertado.
- `CategoriesSection` desktop força 7 colunas com 148px cada = 1036px + gaps. Em telas menores que 1200px, pode haver overflow.
- Footer: 4 colunas em `lg:`, mas em tablet (768-1023px) fica 2 colunas — OK, mas textos de endereço ficam muito longos.

**C. Acessibilidade**
- **Header**: links de navegação não têm `aria-current` para página ativa.
- **Hero carousel**: sem `aria-live`, sem `role="region"`, sem controles de pause. Autoplay sem opção de parar viola WCAG 2.2.2.
- **Botões de cor** no Hero: não têm `aria-label` descritivo (apenas visual).
- **Mega-menu**: não tem `aria-expanded`, `aria-haspopup`.
- **Mobile menu**: não tem `role="dialog"`, `aria-modal`.
- **CategoriesSection mobile carousel**: autoplay sem pause, sem controles de navegação acessíveis.
- **Contraste**: texto `text-muted-foreground` (hsl 222 30% 40%) sobre `bg-background` (hsl 210 20% 98%) = ~4.2:1 — borderline para texto pequeno (mínimo WCAG AA é 4.5:1).
- **Imagens**: hero banner `alt="Brindes corporativos personalizados"` — OK. Logos de clientes `alt="Cliente 1"` — não descritivo. Avatares de testimonials não têm alt descritivo.

**D. Pontos de fricção**
- O botão "BUSCAR BRINDE" sem categoria e sem texto navega para `/produtos` — comportamento pode confundir.
- Filtro de cor no Hero não tem indicação visual clara de qual cor está selecionada (apenas scale + border verde, pode ser sutil).

### Correções propostas

1. Adicionar `aria-label`, `aria-expanded`, `role` nos elementos interativos.
2. Adicionar botão de pause nos carrosséis.
3. Melhorar contraste de `text-muted-foreground` para pelo menos 4.5:1.
4. Adicionar `alt` descritivos em logos de clientes.
5. Mega-menu: adicionar `aria-haspopup="true"` e `aria-expanded`.
6. Mobile menu: `role="dialog"`, `aria-modal="true"`, trap focus.

---

## 3. SEO

### Problemas encontrados

**A. Homepage sem `<Helmet>`**
- `Index.tsx` não tem `<Helmet>`. O `<title>` vem do `index.html` estático ("Gifff") — deveria ser "Gift Web Brindes | Brindes Corporativos Personalizados para Empresas".
- Sem `<meta description>` dinâmica na homepage.
- Sem canonical na homepage.

**B. Sitemap desatualizado**
- `sitemap.xml` tem URLs antigas (`/garrafas`, `/copos`, `/mochilas`) que agora são redirects.
- Não inclui as 32 categorias novas (`/categoria/agendas`, `/categoria/canetas`, etc.).
- Deveria ser gerado dinamicamente ou pelo menos atualizado manualmente.

**C. JSON-LD limitado**
- Só existe `Product` schema no ProductDetail. Faltam:
  - `Organization` schema na homepage (nome, logo, contato, redes sociais).
  - `BreadcrumbList` schema nas páginas de categoria e produto.
  - `FAQPage` schema (se houver FAQ — atualmente não há).
  - `LocalBusiness` schema (tem 2 endereços físicos no footer).
  - `ItemList` schema nas páginas de categoria (lista de produtos).

**D. Headings**
- Homepage tem múltiplos H2 mas nenhum H1 visível (o hero tem H2 em vez de H1).
- `CorporateQuotation` usa H2 — OK.
- Hierarquia geral está razoável nas demais páginas.

**E. Links internos**
- Footer "Quem somos" e "Fale conosco" apontam para `#` — links mortos.
- "Política de troca e devolução" aponta para `#` — link morto.

**F. Canonical tags**
- Existem em CategoryPage, AllProducts, SearchPage, ProductDetail — OK.
- Faltam na homepage e nas páginas legais (Privacy, Terms já têm).

**G. Open Graph / Twitter Cards**
- `index.html` tem OG tags estáticas com título "Gifff". Páginas internas usam Helmet — OK.
- Falta OG image dinâmica por categoria.

### Correções propostas

1. Adicionar `<Helmet>` na homepage com title, description, canonical, OG tags.
2. Atualizar `sitemap.xml` com todas as 32 categorias novas.
3. Adicionar JSON-LD: `Organization`, `LocalBusiness`, `BreadcrumbList`.
4. Mudar hero H2 para H1.
5. Corrigir links mortos no footer.

---

## 4. GEO (Generative Engine Optimization)

### Problemas encontrados

**A. Conteúdo**
- `SeoTextSection` existe mas NÃO está incluída na homepage (removida do Index.tsx). Esse texto rico e contextual ajudaria IAs a entender o negócio.
- Não há seção de FAQ estruturada. Perguntas como "Qual o prazo de entrega?", "Qual a quantidade mínima?" são comuns e citáveis por IAs.
- Testemunhos são hardcoded com nomes fictícios e fotos de `pravatar.cc` — IAs podem detectar isso como não autêntico.

**B. Autoridade e E-E-A-T**
- Não há página "Quem somos" (link no footer aponta para `#`).
- Não há CNPJ ou razão social visível.
- Não há informação sobre tempo de mercado, número real de clientes.
- Política de Privacidade e Termos existem — bom.

**C. Estrutura para citação**
- O conteúdo da homepage é majoritariamente visual/comercial. Falta texto informativo que responda perguntas diretas.
- Não há dados factuais citáveis (ex: "mais de 3.000 produtos", "entrega em 10 dias úteis" — existem no SeoTextSection mas ele não está renderizado).

**D. FAQ ausente**
- Nenhuma seção de FAQ em formato pergunta-resposta. Isso é fundamental para GEO pois IAs extraem respostas diretas de FAQs estruturadas.

### Correções propostas

1. **Reincluir `SeoTextSection`** na homepage.
2. **Criar seção FAQ** com perguntas frequentes + schema `FAQPage` em JSON-LD.
3. **Criar página "Quem somos"** com informações reais da empresa.
4. Adicionar CNPJ/razão social no footer.
5. Substituir testimonials fictícios por reais (ou remover fotos de pravatar).

---

## Resumo de Prioridades

| Prioridade | Item | Impacto |
|------------|------|---------|
| Alta | Helmet na homepage (title, desc, H1) | SEO + GEO |
| Alta | Lazy loading de rotas (React.lazy) | Performance |
| Alta | Preload fonte Inter (sair do @import) | LCP |
| Alta | Sitemap atualizado | SEO |
| Alta | JSON-LD Organization + LocalBusiness | SEO + GEO |
| Média | Seção FAQ + schema FAQPage | GEO + SEO |
| Média | Reincluir SeoTextSection | GEO |
| Média | Acessibilidade (aria-labels, carrosséis) | UX |
| Média | Lazy load imagens faltantes | Performance |
| Média | Links mortos no footer | SEO + UX |
| Baixa | Remover deps não usadas | Performance |
| Baixa | Substituir inline styles por CSS :hover | Performance |
| Baixa | Testimonials reais | GEO |

### Arquivos a editar

- `index.html` — preload font, atualizar meta tags default
- `src/index.css` — remover @import da fonte
- `src/pages/Index.tsx` — adicionar Helmet, reincluir SeoTextSection
- `src/App.tsx` — React.lazy para todas as rotas
- `src/components/HeroSection.tsx` — H1, aria-labels, dimensões de imagem
- `src/components/Header.tsx` — aria-expanded, aria-haspopup
- `src/components/Footer.tsx` — corrigir links mortos, adicionar CNPJ
- `src/components/ClientsSection.tsx` — lazy load imagens, alt descritivo
- `src/components/TrustSection.tsx` — lazy load imagens
- `src/components/TestimonialsSection.tsx` — remover pravatar ou tornar real
- `public/sitemap.xml` — atualizar com 32 categorias
- Novo: `src/components/FAQSection.tsx` — FAQ com schema JSON-LD

