
## Plano

O `FloatingWhatsApp` (FAB com popup) é compartilhado entre site e catálogo. Atualmente o `WhatsAppModal` sempre redireciona para `WHATSAPP_REDIRECT_URL`, ignorando o formulário preenchido.

### Mudanças

**1. `src/components/WhatsAppModal.tsx`**
- Adicionar prop opcional `useDirectMessage?: boolean` (default `false` → mantém comportamento atual com FunnelMax para o site).
- Quando `useDirectMessage = true`: trocar o `window.open(WHATSAPP_REDIRECT_URL...)` por `window.open(\`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join("\n"))}\`, "_blank")` — usando a mensagem montada com nome, telefone, empresa, quantidade, orçamento e detalhes.
- Importar `WHATSAPP_NUMBER` de `@/config/site`.

**2. `src/components/FloatingWhatsApp.tsx`**
- Adicionar prop opcional `useDirectMessage?: boolean` e repassar para `<WhatsAppModal />`.

**3. `src/pages/CatalogPage.tsx`**
- Passar `<FloatingWhatsApp useDirectMessage />`.

**4. `src/pages/CatalogProductDetail.tsx`** (verificar se também usa `FloatingWhatsApp`)
- Se usar, passar `useDirectMessage` também (sub-rota do catálogo).

### O que NÃO muda
- Resto do site (`Index`, `ProductDetail`, etc.) continua com `FloatingWhatsApp` sem prop → mantém FunnelMax.
- `QuotationDrawer` e botão CTA da PDP do catálogo já estão corretos (alterados anteriormente).

### Resultado
- Em `/catalogo` e `/catalogo/produto/:slug`: popup do FAB envia mensagem direta para `wa.me/${WHATSAPP_NUMBER}` com os dados do formulário.
- Em todas as outras páginas: popup continua redirecionando para `track.funnelmax.io`.
