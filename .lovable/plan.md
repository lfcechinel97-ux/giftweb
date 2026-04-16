
## Plano: Trocar todos os links do WhatsApp pela URL do FunnelMax

Substituir todas as URLs `https://wa.me/...` (com ou sem `?text=...`) pela URL fixa `https://track.funnelmax.io/w/wr_4hhbabeuap7zenuk` em todo o site, mantendo comportamento (modal continua abrindo, botões continuam no mesmo lugar). A URL passa a ser uma constante única.

### 1. Centralizar em `src/config/site.ts`
Adicionar nova constante:
```ts
export const WHATSAPP_REDIRECT_URL = "https://track.funnelmax.io/w/wr_4hhbabeuap7zenuk";
```
Manter `WHATSAPP_NUMBER` (ainda usado em texto/exibição).

### 2. Arquivos a alterar (somente o destino do link)

| Arquivo | O que muda |
|---|---|
| `src/components/WhatsAppModal.tsx` | Botão final "Solicitar Orçamento no WhatsApp" → abre `WHATSAPP_REDIRECT_URL` (sem `?text=`, ignora payload) |
| `src/components/Footer.tsx` | Ícone WhatsApp do rodapé + links "Quem somos" e "Fale conosco" → `WHATSAPP_REDIRECT_URL`. Fallback do `linkWa` também usa a nova URL |
| `src/components/Header.tsx` | 3 ocorrências (`https://wa.me/${WHATSAPP_NUMBER}`) → `WHATSAPP_REDIRECT_URL` |
| `src/components/SeoTextSection.tsx` | Link inline → `WHATSAPP_REDIRECT_URL` |
| `src/pages/ProductDetail.tsx` | CTA "Solicitar orçamento no WhatsApp" → `WHATSAPP_REDIRECT_URL` |
| `src/pages/CatalogProductDetail.tsx` | `window.open` do orçamento → `WHATSAPP_REDIRECT_URL` |
| `src/components/catalog/QuotationDrawer.tsx` | `window.open` do envio do orçamento → `WHATSAPP_REDIRECT_URL` |

### 3. O que NÃO muda
- `FloatingWhatsApp.tsx`: continua abrindo o modal normalmente (só o botão final do modal é que aponta para a nova URL).
- Layout, textos, ícones, animações, validações de formulário.
- `WHATSAPP_NUMBER` em `site.ts` (ainda referenciado em outros pontos como exibição).
- CMS `footer_link_whatsapp`: se já tiver valor cadastrado pelo admin, ele tem precedência. Você poderá editá-lo pelo painel se quiser; o fallback no código usará a nova URL.

### Observação
Como a nova URL é um redirecionador externo (FunnelMax), o `?text=...` (mensagem pré-preenchida) deixa de funcionar — o que é esperado, pois o FunnelMax controla o destino final.
