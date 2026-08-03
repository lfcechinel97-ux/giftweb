# Análise de comportamento do lead com PostHog

## O que você vai poder ver
- **Session replay**: gravação da navegação real (mouse, scroll, cliques, formulários mascarados).
- **Mapa de calor**: onde as pessoas clicam em cada página.
- **Localização**: país/estado/cidade derivados do IP, além de dispositivo, navegador e origem do tráfego.
- **Tempo por página** e caminho percorrido (funil de navegação).
- **Eventos de negócio**: produto visualizado, categoria clicada, cor/quantidade escolhida, adicionado ao orçamento, clique em WhatsApp, envio de cotação.
- **Funil de conversão**: Home → Categoria → Produto → Adicionar ao orçamento → WhatsApp, com taxa de abandono em cada etapa.

Onde analisar: painel do PostHog (posthog.com), nas abas Replays, Heatmaps, Insights e Funnels. Todos os eventos abaixo aparecem lá automaticamente.

## Etapas

1. **Conectar o PostHog** via conector do Lovable (você cria/escolhe a conta na hora; o token do projeto é sincronizado automaticamente).

2. **Inicializar o rastreamento** em um arquivo novo `src/lib/analytics.ts`, carregado no `src/main.tsx`:
   - session replay ligado (com mascaramento de campos sensíveis nas páginas /admin e /sistema),
   - heatmaps ligados,
   - captura automática de cliques (autocapture).

3. **Pageviews de SPA**: como o site usa React Router, um pequeno componente dentro do `BrowserRouter` (em `App.tsx`) dispara `$pageview` a cada mudança de rota.

4. **Eventos de negócio** nos pontos que já existem no código:
   - `produto_visualizado` — `ProductDetail.tsx`, `CatalogProductDetail.tsx` (SKU, nome, categoria, preço)
   - `categoria_visualizada` — `CategoryPage.tsx`
   - `busca_realizada` — `SearchPage.tsx` / `HeroCategoryPicker.tsx`
   - `cor_selecionada` e `quantidade_alterada` — `TopProductCard.tsx`, `ProductCard.tsx`
   - `adicionado_ao_orcamento` — `QuotationContext.tsx` / `TopProdutosCart.tsx`
   - `orcamento_enviado_whatsapp` — `QuotationDrawer.tsx` / `TopCartBar.tsx`
   - `clique_whatsapp` — `FloatingWhatsApp.tsx`, `WhatsAppModal.tsx`
   - `lead_enviado` — `LeadCapture.tsx`, `CorporateQuotation.tsx`

5. **Privacidade (LGPD)**: campos de formulário e dados de clientes nas áreas internas (/admin, /sistema) ficam mascarados nas gravações; nenhuma senha é capturada.

## Detalhes técnicos
- Biblioteca `posthog-js`, inicializada com `import.meta.env.VITE_LOVABLE_CONNECTOR_POSTHOG_API_KEY` e host conforme a região do conector.
- Wrapper único (`trackEvent`) para que nenhum componente importe o PostHog direto; se o token não existir, as chamadas viram no-op e nada quebra.
- Nada é removido: GTM, FunnelMax e o pixel CQC continuam como estão.
- Nenhuma alteração de lógica de negócio, preço, orçamento ou banco de dados.

## Observação
O IP bruto não é exibido por padrão (boa prática LGPD) — o PostHog mostra a localização geográfica derivada dele. Se você precisar do IP exato em cada sessão, dá para habilitar como propriedade do evento.
