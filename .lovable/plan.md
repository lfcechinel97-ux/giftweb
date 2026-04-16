<final-text>Diagnóstico

- Revisei o código e os CTAs dos produtos já apontam para `WHATSAPP_REDIRECT_URL = https://track.funnelmax.io/w/wr_4hhbabeuap7zenuk` em:
  - `src/pages/ProductDetail.tsx`
  - `src/pages/CatalogProductDetail.tsx`
  - `src/components/WhatsAppModal.tsx`
  - `src/components/catalog/QuotationDrawer.tsx`
- Também confirmei que essa URL do FunnelMax redireciona para `api.whatsapp.com`. Então a tela que você está vendo não vem de um link antigo no código do site; ela é o destino final configurado no próprio link do FunnelMax.

Do I know what the issue is?

- Sim. O site já está chamando a URL que você passou, mas como essa URL redireciona para o WhatsApp, o navegador acaba exibindo `api.whatsapp.com`. No preview isso ainda pode falhar com `ERR_BLOCKED_BY_RESPONSE`.

Plano

1. Padronizar todos os CTAs de produto para um único handler interno `openWhatsAppRedirect()` usando `window.open(WHATSAPP_REDIRECT_URL, "_blank", "noopener,noreferrer")`.
2. Trocar o CTA principal de `src/pages/ProductDetail.tsx` de `<a href=...>` para botão com esse handler, para evitar navegação direta do preview/iframe.
3. Garantir o mesmo handler em:
   - `src/pages/CatalogProductDetail.tsx`
   - `src/components/WhatsAppModal.tsx`
   - `src/components/catalog/QuotationDrawer.tsx`
4. Não alterar layout, texto, formulário, cores ou posição de nenhum botão.
5. Validar que todos os botões de produto disparam exatamente a mesma URL base `https://track.funnelmax.io/w/wr_4hhbabeuap7zenuk`.

Resultado esperado

- Em todos os produtos, o clique sempre sairá do mesmo ponto do código e abrirá a URL do FunnelMax que você passou.
- Se você quiser que a barra de endereço permaneça em `track.funnelmax.io` sem ir para `api.whatsapp.com`, isso não é controlado pelo site; aí será preciso mudar o redirecionamento configurado no próprio FunnelMax.</final-text>