
O usuário está certo. No `supabase/functions/product-feed/index.ts` a constante `SITE_URL` está hardcoded como `https://giftwebbrindes.com.br`, mas o domínio real é `https://giftweb.lovable.app`.

## Plano

**1. Atualizar `SITE_URL` em `supabase/functions/product-feed/index.ts`**
- Trocar `"https://giftwebbrindes.com.br"` por `"https://giftweb.lovable.app"`
- Redeploy automático da edge function

**2. Atualizar `src/config/site.ts`**
- Mesma constante `SITE_URL` está hardcoded lá. Trocar para `https://giftweb.lovable.app` para manter consistência (usado em outros pontos do site, como sitemap/SEO).

**3. Verificar `public/sitemap.xml`**
- Se houver URLs com `giftwebbrindes.com.br`, substituir por `giftweb.lovable.app`.

## Resultado
Após o deploy, o feed em `https://ozkbfxvouxgsdthnweyr.supabase.co/functions/v1/product-feed` passará a gerar links como:
`https://giftweb.lovable.app/produto/agenda-2026-cromato-14926-vm`

No Google Merchant Center será necessário clicar em "Buscar agora" para forçar a releitura.
