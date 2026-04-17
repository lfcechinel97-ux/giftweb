
## Entendimento

No `/catalogo` (e suas subpáginas) o WhatsApp deve voltar a enviar a mensagem com os itens do orçamento (nome, código, qtd, preço). No resto do site continua usando `WHATSAPP_REDIRECT_URL` (FunnelMax).

## Pontos afetados

1. **`src/components/catalog/QuotationDrawer.tsx`** — botão "Enviar orçamento via WhatsApp" no drawer lateral do catálogo.
   - Hoje: monta `lines` mas ignora e abre `WHATSAPP_REDIRECT_URL`.
   - Mudar para: `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}` com a mensagem já montada (itens + total).

2. **`src/pages/CatalogProductDetail.tsx`** — botão de orçamento na página de produto do catálogo (`/catalogo/produto/:slug`).
   - Hoje: abre `WHATSAPP_REDIRECT_URL` direto.
   - Mudar para: montar mensagem com nome do produto, código e quantidade selecionada e abrir via `wa.me/${WHATSAPP_NUMBER}?text=...`.

3. **Popup/CTA da página inicial do catálogo (`/catalogo`)** — verificar se há algum botão "popup" específico no `CatalogPage` ou `QuotationBar` que dispara WhatsApp. Se existir, também usar `wa.me` com itens do `QuotationContext`. Se for o mesmo `QuotationDrawer`, já é resolvido pelo item 1.

## O que NÃO muda

- `src/components/WhatsAppModal.tsx` (modal do FAB global) → continua com `WHATSAPP_REDIRECT_URL`.
- `src/pages/ProductDetail.tsx` (página de produto fora do catálogo) → continua com `WHATSAPP_REDIRECT_URL`.
- `src/components/FloatingWhatsApp.tsx` → inalterado.
- Constante `WHATSAPP_REDIRECT_URL` permanece, usada só fora do catálogo.

## Formato da mensagem (catálogo)

```
Olá! Gostaria de solicitar um orçamento:

1. Caneca Cerâmica (Cód: ABC123) — Qtd: 50 — R$ 12,90/un
2. Camiseta Algodão (Cód: XYZ789) — Qtd: 30 — sob consulta/un

Total de itens: 80
```

Na página de produto do catálogo, mensagem com 1 item baseada no produto + qtd atual.
