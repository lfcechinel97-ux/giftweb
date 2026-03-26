
Objetivo: corrigir a causa real do banner “sair para fora” no celular físico, sem mexer no filtro de preço nem no restante da homepage.

1. Causa mais provável identificada no código atual
- O `HeroSection` ainda força o container do carrossel com `aspectRatio: "16 / 9"` em todas as telas.
- No mobile real, o banner usado pode ter proporção diferente do preview e, como o container fica preso em 16:9, a imagem é cortada/estourada visualmente.
- Além disso, a escolha mobile/desktop depende de `window.innerWidth` em JavaScript. Em celular real isso pode divergir do layout efetivo no primeiro paint e durante resize/orientação.

2. Correção que vou aplicar
- Remover a dependência de `window.innerWidth` para decidir qual banner carregar no hero.
- Trocar o `<img>` principal do hero por uma solução responsiva real (`<picture>` ou duas sources por media query), para que o próprio navegador escolha o banner mobile ou desktop.
- Manter o primeiro render com fallback local imediato, mas com source responsiva.
- No mobile, parar de forçar `aspect-ratio: 16/9` se o banner mobile tiver outra proporção; usar uma proporção própria do mobile ou deixar a altura seguir a imagem sem extrapolar largura.
- Garantir no wrapper do banner:
  - `w-full`
  - `max-w-full`
  - `overflow-hidden`
  - nenhum `min-width`, `translate`, ou largura fixa em px

3. Ajuste específico no HeroSection
- Revisar apenas o bloco do carrossel:
  - container externo
  - wrapper de cada slide
  - tag da imagem/banner
- Garantir:
  - imagem com `display:block`
  - `width:100%`
  - `height:100%` apenas se a proporção do container estiver correta
  - `object-cover` somente se o crop for intencional e controlado
- Se o problema for banner mobile com proporção diferente, usar:
  - desktop: mantém proporção atual
  - mobile: proporção própria do asset mobile, para não “estourar” horizontalmente

4. O que não vou alterar
- filtro de preço
- botões rápidos
- slider
- badge “mais pedido”
- lógica de navegação
- outras seções

5. Arquivos a ajustar
- `src/components/HeroSection.tsx`
- possivelmente `index.html` apenas se o preload do hero também precisar virar responsivo para combinar com o banner correto no mobile

6. Resultado esperado
- no preview mobile e no celular real, o banner fica totalmente contido na largura da tela
- sem scroll horizontal
- sem imagem “para fora da página”
- sem depender de cálculo JS para decidir banner mobile vs desktop
- sem quebrar desktop

7. Detalhe técnico importante
- Hoje o código usa `window.innerWidth < 768` e um container fixado em `16/9`. Essa combinação é frágil em dispositivo real.
- A correção mais segura é deixar a responsividade do banner ser decidida por CSS/browser (`<picture>` + media query) e alinhar a proporção do container ao asset mobile real.
