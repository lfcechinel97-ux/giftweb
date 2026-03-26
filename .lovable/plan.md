
Objetivo: corrigir somente o bug do handle direito no filtro de preço do HeroSection, sem mexer no layout geral nem nas demais funcionalidades.

1. Confirmar e atacar a causa real
- O slider atual usa `@radix-ui/react-slider` em `src/components/ui/slider.tsx` e é consumido em `src/components/HeroSection.tsx`.
- O problema não é “dois inputs range empilhados”; hoje não há `input type="range"` no projeto.
- A falha está na lógica controlada do range: o `HeroSection` só recebe o array final em `handleSliderChange`, mas não preserva explicitamente qual thumb o usuário pretendia mover. Com faixa não linear e thumbs próximos, o valor mínimo pode “capturar” a interação do máximo.

2. Ajuste planejado no HeroSection
- Adicionar estado/ref para rastrear qual thumb está ativo: `min` ou `max`.
- No início da interação (pointer/touch down na área do slider), calcular qual thumb está mais próximo do ponto tocado/clicado.
- Se os dois estiverem muito próximos, usar a direção do movimento para desempatar:
  - arrasto para a direita prioriza o thumb máximo
  - arrasto para a esquerda prioriza o thumb mínimo
- Ao receber `onValueChange`, reconciliar os valores preservando o thumb ativo, em vez de aceitar cegamente a troca de posição do array.

3. Pequeno ajuste no componente Slider reutilizável
- Expor metadados/handlers necessários no `src/components/ui/slider.tsx` para permitir:
  - identificar cada thumb (`data-thumb-index`)
  - capturar início da interação no track/root
  - manter visual atual das bolinhas
- Não alterar o desenho do slider; apenas instrumentar a interação.

4. Regra de comportamento que será implementada
- O handle direito nunca poderá mover o esquerdo.
- O handle esquerdo nunca poderá “pular” para a posição do direito.
- Quando o usuário clicar/arrastar perto do handle máximo, a atualização deve atuar no máximo.
- Quando clicar/arrastar perto do mínimo, deve atuar no mínimo.
- Continuar respeitando:
  - range duplo
  - preenchimento verde entre handles
  - inputs manuais sincronizados
  - quick filters
  - teto atual de R$400
  - URL com `preco_min` e `preco_max`

5. Arquivos a alterar
- `src/components/HeroSection.tsx`
  - corrigir a lógica de captura/prioridade do thumb
  - preservar sincronização com inputs e atalhos
- `src/components/ui/slider.tsx`
  - adicionar suporte mínimo para identificação/início da interação sem mudar visual

6. Resultado esperado
- Ao tentar arrastar a bolinha da direita, a esquerda não irá mais até lá.
- O usuário conseguirá mexer no preço máximo de forma previsível, inclusive quando os handles estiverem próximos.
- O visual atual do HeroSection permanece igual.

7. Validação que farei na implementação
- Arrastar só o thumb direito com thumbs afastados
- Arrastar só o thumb direito com thumbs próximos
- Arrastar só o thumb esquerdo
- Clicar nos atalhos e depois ajustar manualmente no slider
- Confirmar que a busca continua navegando com `preco_min` e `preco_max`
