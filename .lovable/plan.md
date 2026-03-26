

# Correção: Banner overflow no mobile + Scroll to top

## Diagnóstico

### Bug 1 — Banner overflow no mobile
O container do carrossel no HeroSection (linha 304) tem `aspectRatio: "16/9"` como inline style, que pode fazer o elemento expandir além da largura disponível. Além disso, a `section` pai tem `overflow-hidden` mas o `div.container` interno não tem `max-width: 100%` explícito — o Tailwind `container` class aplica `padding: 2rem` mas não limita a largura a 100vw em telas pequenas.

**Causa provável**: O carousel div com `lg:w-[64%]` fica 100% no mobile, mas dentro de um `container` com padding de 2rem (32px cada lado). O `aspectRatio: 16/9` no style inline pode forçar largura além do disponível dependendo da altura mínima de 270px.

**Correção**:
1. Adicionar `max-w-full` e `overflow-hidden` ao wrapper `div.container` do HeroSection (linha 155)
2. Garantir que a `section` raiz e o carousel div tenham `overflow: hidden`
3. Adicionar `overflow-x: hidden` na `main` do Index.tsx como camada extra de segurança

### Bug 2 — Scroll não volta ao topo
O componente `ScrollToTop` **já existe** em `App.tsx` (linhas 36-40) e está posicionado corretamente dentro do `BrowserRouter` (linha 56). No teste que fiz, a navegação para outra página **abriu no topo** corretamente.

**Possíveis causas de falha intermitente**:
- A query string muda mas o pathname permanece igual (ex: `/produtos?preco_min=10` → `/produtos?preco_min=30`), e o `useEffect` só depende de `pathname`, não de `search`
- Navegação via `navigate()` com apenas mudança de query params não dispara o scroll

**Correção**: Incluir `search` (query string) no `useEffect` do `ScrollToTop` para que mudanças de filtros também façam scroll ao topo.

## Alterações

### Arquivo 1: `src/App.tsx` (linhas 36-39)
Mudar o `ScrollToTop` para observar `pathname` + `search`:
```tsx
const ScrollToTop = () => {
  const { pathname, search } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname, search]);
  return null;
};
```

### Arquivo 2: `src/components/HeroSection.tsx` (linha 155)
Adicionar `overflow-hidden max-w-full` ao container:
```tsx
<div className="container flex flex-col lg:flex-row relative z-10 gap-5 overflow-hidden max-w-full" style={{ minHeight: 270 }}>
```

### Arquivo 3: `src/pages/Index.tsx` (linha 74)
Adicionar `overflow-x-hidden` à `main`:
```tsx
<main className="flex-1 overflow-x-hidden">
```

## Não altera
- Filtro de preço, slider, botões rápidos
- Badge "mais pedido"
- Layout, cores, tipografia
- Nenhum outro componente

