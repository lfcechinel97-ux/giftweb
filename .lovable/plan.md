

# Correção: Thumb do slider difícil de arrastar

## Problema
O thumb do slider tem apenas 18×18px de área clicável, tornando difícil clicar e arrastar, especialmente no mobile. A classe `touch-none` no Root do Radix impede o comportamento natural de arrasto contínuo.

## Causa raiz
1. **Área de toque pequena demais** — 18×18px é menor que o mínimo recomendado de 44×44px para interação por toque
2. **Sem retenção de captura** — quando o dedo/mouse sai do thumb durante o arrasto, pode perder o "grab"

## Correção (apenas `src/components/ui/slider.tsx`)

Aumentar a área de interação do thumb sem mudar o visual:
- Manter o visual de 18×18px (via pseudo-element ou background)
- Expandir a área clicável real para **44×44px** usando padding + `box-sizing` ou uma técnica de hit-area invisível
- Adicionar `touch-action: none` no thumb individual para garantir que o browser não intercepte o gesto
- Usar `style={{ WebkitTapHighlightColor: 'transparent' }}` para evitar flash no mobile

```tsx
<SliderPrimitive.Thumb
  key={i}
  className="relative block h-5 w-5 rounded-full border-2 border-primary bg-background 
    ring-offset-background transition-colors cursor-grab active:cursor-grabbing
    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring 
    before:absolute before:inset-[-12px] before:content-[''] before:rounded-full"
  style={{ touchAction: 'none' }}
/>
```

O `before:absolute before:inset-[-12px]` cria uma área invisível de ~44px ao redor do thumb de 20px, facilitando o clique/toque sem mudar o visual. O Radix Slider já usa pointer capture internamente, então uma vez que o thumb é "agarrado", ele mantém o tracking mesmo com o mouse longe — o problema atual é apenas não conseguir acertar o thumb inicial.

## Arquivos alterados
- `src/components/ui/slider.tsx` — apenas expandir hit area do thumb

Nenhuma mudança no `HeroSection.tsx`, layout, cores ou lógica de filtragem.

