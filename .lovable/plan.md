
## Diagnóstico

Encontrei 2 problemas:

### 1. `src/pages/CatalogProductDetail.tsx` (linha 252) — bug real
Ainda usa `https://wa.me/${WHATSAPP_NUMBER}?text=...` em vez do `WHATSAPP_REDIRECT_URL`. Isso é a página `/catalogo/produto/:slug` (segunda imagem que você mandou).

### 2. `src/pages/ProductDetail.tsx` (linhas 297–299) — dead code que confunde
A variável `whatsappMsg` ainda existe com o texto "Tenho interesse no produto: ..." mas **nunca é usada** (o botão da linha 550 já aponta para `WHATSAPP_REDIRECT_URL`). A primeira imagem (`api.whatsapp.com/send/?...BLOCO DE ANOTAÇÕES`) é cache antigo do navegador — o código atual da página de produto desktop está correto.

## Plano

**Arquivo 1: `src/pages/CatalogProductDetail.tsx`**
- Remover import `WHATSAPP_NUMBER` (não será mais usado lá), adicionar `WHATSAPP_REDIRECT_URL`.
- Linha 252: trocar `window.open(\`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}\`, "_blank")` por `window.open(WHATSAPP_REDIRECT_URL, "_blank")`.

**Arquivo 2: `src/pages/ProductDetail.tsx`**
- Remover as linhas 297–299 (`const whatsappMsg = encodeURIComponent(...)`) — dead code.

## Depois disso
- Faça **hard reload** no navegador (Ctrl+Shift+R) para limpar o cache.
- Todos os botões de WhatsApp do site irão abrir `https://track.funnelmax.io/w/wr_4hhbabeuap7zenuk`.
