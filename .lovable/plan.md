
## Plano

**1. Remover "10 dias úteis" + ícone de relógio da página de produto**
- `src/pages/ProductDetail.tsx` (linhas 435–438): remover o `<div>` com `<Clock />` + `{PRAZO_PRODUCAO}`.
- Remover import `Clock` do `lucide-react` se não for usado em outro lugar do arquivo.

**2. Atualizar o prazo global para "de 2 a 10 dias úteis"**
- `src/config/site.ts`: alterar `PRAZO_PRODUCAO = "10 dias úteis"` → `PRAZO_PRODUCAO = "de 2 a 10 dias úteis"`.

Isso atualiza automaticamente todos os outros locais que usam a constante (FAQ, HowItWorks, textos institucionais), mantendo consistência.

**3. Verificar strings hardcoded "10 dias úteis"**
- Buscar no projeto por ocorrências literais de "10 dias úteis" fora da constante (ex: FAQ, HowItWorks, SeoTextSection) e ajustar para "de 2 a 10 dias úteis" caso existam.

## Resultado
- Página de produto: sem o badge de relógio.
- Demais menções de prazo no site: passam a exibir "de 2 a 10 dias úteis".
