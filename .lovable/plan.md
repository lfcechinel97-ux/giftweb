

# Ajustes no catálogo — Slider, Preço, Hero e Header

## 1. Slider: step de R$5 e bug do thumb

**Problema do thumb**: O Radix Slider com dois thumbs às vezes confunde qual thumb mover quando estão próximos. O `minStepsBetweenThumbs` ajuda, mas o problema principal é que ao clicar na track, o Radix move o thumb mais próximo do ponto clicado. Quando o max está baixo (ex: 30) e o min está em 0, clicar perto do max pode mover o min.

**Solução**: Adicionar `minStepsBetweenThumbs={1}` ao Slider em ambos os arquivos. Manter `step={5}` (já está).

## 2. Botões rápidos: adicionar R$200 e R$400 + lógica de faixa

**Botões**: Adicionar `{ label: "Até R$200", min: 0, max: 200 }` e `{ label: "Até R$400", min: 0, max: 400 }` ao array `QUICK_PRICES` em ambos `CatalogFilterBar.tsx` e `CatalogMobileFilters.tsx`.

**Lógica de faixa progressiva**: Quando clica "Até R$30", setar `precoMin: 10.01, precoMax: 30`. A lógica:
- Até R$10 → min: 0, max: 10
- Até R$30 → min: 10.01, max: 30
- Até R$50 → min: 30.01, max: 50
- Até R$100 → min: 50.01, max: 100
- Até R$200 → min: 100.01, max: 200
- Até R$400 → min: 200.01, max: 400

**Ordenação**: Quando um botão rápido é clicado, forçar `sort: "maior_preco"` para mostrar os mais caros primeiro (respeitando a lógica do RPC que já coloca sem estoque por último).

## 3. Slider max range

Desktop: `max={Math.max(400, filters.precoMax)}` (para acomodar o novo botão "Até R$400").
Mobile: `max={Math.max(400, filters.precoMax)}` (mesma lógica, já que agora tem botão até R$400).

## 4. Hero do catálogo — redesign (anexo 3)

Redesenhar a section hero (linhas 168-179 de `CatalogPage.tsx`) com:
- Fundo gradiente mais elaborado (dark com pattern sutil ou gradiente multi-stop)
- Tipografia mais estilizada: "Catálogo Digital" em fonte fina/light, "Gift Web" em bold verde
- Subtítulo mais legível com melhor contraste
- Espaçamento e padding mais generosos

## 5. Header — ícone carrinho

Em `CatalogHeader.tsx`, trocar `ShoppingBag` por `ShoppingCart` (ambos do lucide-react).

## Arquivos afetados

- `src/components/catalog/CatalogFilterBar.tsx` — novos botões, lógica de faixa, slider minSteps
- `src/components/catalog/CatalogMobileFilters.tsx` — mesmas mudanças
- `src/components/catalog/CatalogHeader.tsx` — ícone ShoppingCart
- `src/pages/CatalogPage.tsx` — hero redesign

## Não alterar

- Nenhum componente fora de /catalogo
- slider.tsx global, Header.tsx, Footer.tsx do site

