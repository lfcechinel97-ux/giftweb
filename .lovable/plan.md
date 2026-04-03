

# Correções no catálogo — Cores, Mobile e Slider

## Problemas e soluções

### 1. CORES NÃO APARECEM (desktop + mobile)
**Causa raiz**: O código usa `backgroundColor` e `background` no mesmo objeto `style`, com um deles como `undefined`. Em React, quando o shorthand `background` aparece no objeto (mesmo como `undefined`), pode interferir com `backgroundColor`. Solução: usar **apenas `background`** para todas as cores — hex simples para cores normais, `conic-gradient` para "Outros".

Ambos os arquivos: `CatalogFilterBar.tsx` (linha ~229-231) e `CatalogMobileFilters.tsx` (linha ~173-174):
```tsx
// DE:
backgroundColor: isOutros ? undefined : swatch.bg,
background: isOutros ? "conic-gradient(...)" : undefined,

// PARA:
background: isOutros ? "conic-gradient(...)" : swatch.bg,
```
Remover `backgroundColor` completamente.

### 2. Mobile: texto "Ou busque por categoria e preço"
Em `CatalogMobileFilters.tsx`, entre o input de busca (linha 77) e a seção Categoria (linha 79), adicionar:
```tsx
<p className="text-sm text-muted-foreground text-center">Ou busque por categoria e preço</p>
```

### 3. Mobile: Categoria sempre visível (sem Collapsible)
Remover o wrapper `Collapsible`/`CollapsibleTrigger`/`CollapsibleContent`. Renderizar diretamente:
- Label "Categoria" (sem estado colapsável)
- `<select>` nativo com opção default "Todas as categorias" (sem pré-seleção)
- Remover `useState(false)` do `catOpen`

### 4. Slider thumb menor (mobile)
No `CatalogMobileFilters.tsx`, passar uma `className` customizada ao `<Slider>` ou criar um wrapper. Na verdade, o thumb é controlado pelo componente `slider.tsx` com `h-5 w-5`. Para mobile, a solução mais simples é passar uma className ao Slider e usar CSS para reduzir o thumb. Alternativa: usar inline style no container.

Melhor abordagem: adicionar uma prop ou className ao Slider no mobile para thumbs menores. Como o Slider é global, vou adicionar uma classe wrapper no mobile e usar CSS descendant selector no `index.css`:
```css
.slider-small-thumb [data-radix-slider-thumb] {
  width: 16px;
  height: 16px;
}
```

### 5. Slider — faixa 0-70 priorizada (mobile) e 0-100 (desktop)
O slider atual vai de 0 ao `maxPreco` (400). O pedido é que a maior parte do trilho cubra 0-70 (mobile) e 0-100 (desktop). Isso requer mapeamento não-linear.

Abordagem simples e eficaz: reduzir o `max` visual do slider para 100 (desktop) e 70 (mobile) nos botões rápidos e no slider principal, mas manter a possibilidade de digitar valores maiores nos inputs. Isso é mais previsível do que mapeamento não-linear.

**Desktop** (`CatalogFilterBar.tsx`): mudar `max={maxPreco}` do Slider para `max={Math.max(100, filters.precoMax)}` — assim o slider vai até 100 por padrão, mas se o usuário digitar 200 no input, o slider se adapta.

**Mobile** (`CatalogMobileFilters.tsx`): mesma lógica mas com `max={Math.max(70, filters.precoMax)}`.

### 6. Remover "x produtos encontrados" 
Já foi removido na versão anterior, confirmar que não voltou.

## Arquivos afetados
- `src/components/catalog/CatalogFilterBar.tsx` — fix cores, slider max
- `src/components/catalog/CatalogMobileFilters.tsx` — fix cores, texto separador, categoria sempre visível, slider menor e max 70
- `src/index.css` — classe para thumb menor (opcional, pode fazer inline)

## Não alterar
- Nenhum componente fora de /catalogo
- HeroSection, Header, Footer, slider.tsx global

