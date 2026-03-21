
## Problema

Na página do produto há duas fileiras de miniaturas abaixo da imagem principal:
1. `extraImages` — fotos adicionais do produto (correto, deve existir)  
2. `allVariants` thumbnails (linhas 327–354) — duplica o seletor de cores que já existe no painel direito

A fileira duplicada de variantes é o que aparece na screenshot: as garrafas em azul, preto, dourado etc. ao clicar nelas troca a variante porque chama `handleSwitchVariant`.

## Solução

Remover a fileira duplicada de miniaturas de variantes (linhas 327–354 em `ProductDetail.tsx`).

O seletor de cores no painel direito (linhas 367–428) já cumpre essa função com interface melhor (tooltips, badge "Sem estoque", etc).

Após a remoção, abaixo da imagem principal ficará apenas:
- A fileira de `extraImages` (fotos adicionais enviadas pelo admin — ângulos diferentes, etc.)
- Se não houver fotos extras, nada é exibido

## Arquivo a editar

- `src/pages/ProductDetail.tsx`: remover o bloco `{allVariants.length > 1 && (<div>...thumbnails de variantes...</div>)}` das linhas 327–354
