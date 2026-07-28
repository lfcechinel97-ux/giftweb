## Escopo

Apenas alterações visuais/interativas na página `/topprodutos`. Nada de mudanças em banco de dados, backend ou outras rotas.

## Alterações

### 1. Fundo branco da página
- Em `src/pages/TopProdutos.tsx`, trocar `bg-[#f8fafc]` do wrapper por `bg-white`.
- Ajustar seções internas (`MaisVendidosSection`, `CategoriasGrid`) se tiverem fundo cinza próprio, para não gerar contraste.

### 2. Cards de produto sem borda + imagem preenchendo o retângulo
Em `src/components/topprodutos/TopProductCard.tsx`:
- Remover `border border-slate-200` e sombras dos botões da imagem (tanto modo editorial quanto legacy).
- Manter apenas o `rounded-2xl` e o `bg-white`.
- Remover as escalas `w-[92%] h-[86%]` / `w-[85%]` etc. e o `p-6` do legacy. A imagem passa a usar `w-full h-full object-contain` com padding mínimo (`p-2` ou `p-3`) para respirar sem sobrar espaço.

### 3. Padronizar tamanho das imagens (4:5)
- Trocar todos os `aspect-*` e `min-h-*` do modo editorial por um único `aspect-[4/5]` em TODOS os cards da grade.
- Remover a hierarquia L/M/S de altura de imagem — todos ficam iguais. (O nome/preço/CTA abaixo do card continuam livres.)
- Ajustar `MaisVendidosSection` e `CategoriasGrid` para não passar mais `size="L"`/`"M"` que gerem alturas diferentes, ou fazer o card ignorar `size` no dimensionamento da imagem.

### 4. Bolinha de cor (hex) na home em vez de miniatura da variação
Em `TopProductCard.tsx`, componente `ColorSwatches`:
- Filtrar `cores` para exibir apenas as que tiverem `referencia` (hex) preenchido — se vazio, não renderiza a bolinha.
- Substituir o `<img>` da miniatura por uma `<span>` com `background: c.referencia` (usar `style` inline), tamanho ~24px, `rounded-full`, `ring-1 ring-slate-200`, ativo com `ring-2 ring-green-cta ring-offset-2`.
- Ao clicar, além de marcar como ativa, atualizar a imagem principal do card para `c.imagem` (mudança de comportamento: hoje a regra era "nunca troca"; o usuário pediu para trocar).
- Manter o hover de "segunda foto" apenas quando nenhuma cor está selecionada.

### 5. Tiers de preço clicáveis (20 / 50 / 100 un)
- Transformar cada tile de `PriceTiers` em `<button>`.
- Ao clicar, chamar `setQtd(t.qty)` (já respeita o mínimo). Realçar o tier ativo (quando `qtd === t.qty`) com borda verde `border-green-cta` e texto navy.
- Manter o `+/-` funcionando normalmente.

### 6. Botão CTA — apenas suavizar visual
- Manter o verde `bg-green-cta` (o usuário não quis trocar o tom).
- Reduzir a "poluição": tirar `uppercase` + `tracking-[0.12em]`, usar texto em caixa normal "Adicionar ao orçamento", peso `font-medium`, sem `hover:scale`, apenas `hover:brightness-105`. Deixa mais limpo sem mudar a cor.

## Arquivos afetados

- `src/pages/TopProdutos.tsx` — fundo branco
- `src/components/topprodutos/TopProductCard.tsx` — sem borda, aspect 4:5, swatches por hex com troca de imagem, tiers clicáveis, CTA suavizado
- `src/components/topprodutos/MaisVendidosSection.tsx` — remover variação de `size` se necessário
- `src/components/topprodutos/CategoriasGrid.tsx` — idem

## Fora de escopo

- Nenhuma alteração em `categoryPalettes.ts`, banco de dados, modal, header, faixa de regras comerciais ou outras páginas.
