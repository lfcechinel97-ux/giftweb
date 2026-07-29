## 1. Prévia bonita no WhatsApp (og:image)

Hoje o `index.html` usa um screenshot automático do preview do Lovable (URL `pub-...r2.dev`), que é a imagem feia que aparece.

- Gerar uma imagem de capa própria 1200x630 com identidade Gift Web (navy + verde, logo, "Brindes Corporativos Personalizados", mockups de brindes) e publicá-la em `public/og-cover.jpg`.
- Trocar `og:image` e `twitter:image` no `index.html` para `https://www.giftwebbrindes.com.br/og-cover.jpg`, com `og:image:width/height` e `og:image:alt`.
- Adicionar as mesmas tags og no Helmet da home (`src/pages/Index.tsx`).
- Observação: o WhatsApp guarda cache da prévia por vários dias; links já enviados podem continuar mostrando a imagem antiga por um tempo.

## 2. Teclado abrindo sozinho no mobile

Em `src/components/HeroCategoryPicker.tsx` o input de busca tem `autoFocus`, o que abre o teclado assim que a lista é aberta.

- Remover o `autoFocus` (foco só quando o cliente tocar no campo "Buscar categoria...").
- Manter foco automático apenas no desktop (via `useIsMobile`), onde não atrapalha.

## 3. Lista de categorias estilo Apple (com imagem)

Ainda no `HeroCategoryPicker`:

- Substituir a setinha (`ChevronRight`) por uma miniatura quadrada arredondada (40px) com a imagem da categoria; um pequeno indicador de aberto/fechado discreto fica à direita.
- Remover a contagem de subcategorias no fim de cada linha.
- Tirar o negrito: títulos de grupo em peso normal/medium, subitens em peso leve, mais respiro entre linhas, divisórias sutis — visual clean tipo Apple.
- Gerar 1 imagem por grupo de categoria (os grupos de `src/config/categoryGroups.ts`: Copos/Garrafas/Canecas, Mochilas/Bolsas, Necessaires, Cadernetas/Canetas, Chaveiros/Kit Executivo, Caixas de Som/Fones, Sacolas, Kit Churrasco/Vinho, Térmicas/Madeira, etc.), em estilo consistente (produto sobre fundo claro neutro), salvas em `src/assets` e mapeadas por título do grupo.

## 4. Ordem e tipografia na home mobile

Em `src/pages/Index.tsx` / `HeroSection.tsx`:

- No mobile, o banner (carrossel) passa a aparecer **primeiro**, depois o card "Explore nosso catálogo", e depois "Solicite uma cotação para sua empresa" (`CorporateQuotation` desce para depois do Hero no mobile). No desktop a disposição atual (filtro à esquerda, banner à direita) é mantida — feito com `order` responsivo, sem duplicar componentes.
- Tipografia do título "Explore nosso catálogo de brindes:" trocada de `font-black` para um estilo mais elegante: peso leve/medium, tracking negativo, tamanho ligeiramente maior, com "brindes" em destaque verde — mesma linguagem usada em /topprodutos.

## Detalhes técnicos

Arquivos afetados: `index.html`, `src/pages/Index.tsx`, `src/components/HeroSection.tsx`, `src/components/HeroCategoryPicker.tsx`, novos assets de imagem em `src/assets` e `public/og-cover.jpg`. Nenhuma mudança de dados/backend; lógica de busca e filtros permanece intacta.
