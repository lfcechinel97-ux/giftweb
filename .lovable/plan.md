

# Ajuste do badge "mais pedido" no botão "Até R$50"

## Problema atual
A medalha e o texto "mais pedido" estão **dentro** do botão "Até R$50", usando `flex-col`, o que faz o botão ficar mais alto que os outros e quebra o alinhamento visual.

## Solução
Posicionar a medalha + "mais pedido" **acima** do botão usando `position: absolute` ou wrapper relativo, mantendo o botão "Até R$50" com exatamente o mesmo tamanho e alinhamento dos demais (Até R$10, Até R$30, Até R$100).

### Implementação (apenas `src/components/HeroSection.tsx`)

1. Envolver o botão "Até R$50" em um `<div className="relative">` 
2. Mover o badge (medalha + "mais pedido") para um elemento **acima** do botão, posicionado com `absolute bottom-full` para flutuar sobre ele
3. O botão em si fica com layout idêntico aos outros — mesma altura, mesmo padding `py-1`, sem `flex-col`
4. O badge flutuante terá: medalha dourada (12px) + texto "mais pedido" em itálico, 10px, cor #F59E0B, centralizado horizontalmente sobre o botão
5. Manter a borda dourada sutil no botão quando não ativo

```text
   🏅 mais pedido     ← badge flutuante (absolute, acima)
  ┌──────────────┐
  │  Até R$50    │    ← botão com mesmo tamanho dos outros
  └──────────────┘
```

### Não alterar
- Tamanho/layout dos outros botões
- Slider, inputs, cores, responsividade
- Lógica de filtro ou navegação

