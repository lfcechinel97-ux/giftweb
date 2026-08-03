# Nova página /top10produtos (TOP 10 XBZ por categoria)

Cópia da experiência da `/topprodutos`, alimentada pela planilha TOP10_XBZ_por_Categoria.xlsx. A `/topprodutos` atual não é tocada — nem página, nem componentes, nem tabela.

## O que a planilha traz
- 260 produtos, ordenados por unidades vendidas na XBZ
- 26 categorias agrupadas em 10 seções:
  - Copos, Garrafas e Canecas (Copos, Garrafas Térmicas/Squeezes, Garrafas de Inox/Alumínio, Canecas)
  - Mochilas, Bolsas Térmicas e Malas
  - Necessaires, Porta Joias e Kit Manicure
  - Cadernetas, Agendas, Blocos e Canetas
  - Chaveiros, Mouse Pad e Kit Executivo
  - Caixas de Som, Fones e Power Bank
  - Sacolas de Algodão e TNT
  - Kit Churrasco e Kit Vinho
  - Marmitas e Tábuas de Madeira
  - Guarda-Chuvas

## De onde vêm as informações dos produtos
Do catálogo do próprio site (`products_cache`, sincronizado com a XBZ): nome, imagem principal, galeria, variações de cor, estoque e preço — o mesmo preço calculado que já aparece nas outras páginas, respeitando tabela de preços customizada quando existir.

O código da planilha nem sempre bate literalmente com o do site (a planilha traz `3006`, o site guarda `03006`; a planilha traz `O@08141`, o site usa outro formato). A busca será feita em cascata: código exato → código com zeros à esquerda (5 dígitos) → sem o prefixo `X@` → por nome do produto. Um teste de amostra confirmou que a maioria resolve já no segundo passo.

## Estrutura da página
- Rota `/top10produtos`, mobile-first, mesma identidade da `/topprodutos` (azul marinho + verde, tipografia leve, cards brancos)
- Topo com as 10 seções; dentro de cada seção, as categorias com seu TOP 10 numerado (1 a 10, posição visível no card)
- Card reaproveitando o visual atual: imagem, nome, faixas de preço 20/50/100 un., seletor de cor, troca de imagem no hover (desktop), seletor de quantidade ±5 e "Adicionar ao orçamento"
- Modal de detalhe e carrinho/orçamento via WhatsApp iguais aos da `/topprodutos`
- Navegação rápida por categoria (chips no topo, rolagem até a seção)
- Produtos sem correspondência no catálogo não aparecem na página (ficam listados no admin para você resolver depois)

## Detalhes técnicos
- Nova tabela `top10_xbz` (secao, categoria, ordem_secao, ordem_categoria, posicao, codigo_planilha, nome_planilha, unid_vend, produto_id resolvido, ativo) com RLS: leitura pública, escrita só para admin; GRANTs para anon/authenticated/service_role
- Migração popula as 260 linhas da planilha e roda a cascata de matching para preencher `produto_id`
- Nova página `src/pages/Top10Produtos.tsx` + componentes próprios em `src/components/top10produtos/` (cópias adaptadas de `TopProductCard`, `TopProductModal`, `TopCartBar`), sem importar nem alterar os arquivos de `topprodutos/`
- Preço via `getEffectiveMinPrice`/`getEffectiveUnitPrice` de `@/utils/price.ts`, como no restante do site
- Página admin `/admin/top10produtos`: ativar/desativar item, reordenar, e corrigir manualmente o produto vinculado nos casos sem match
- Rota adicionada em `App.tsx`; nenhuma rota ou componente existente é modificado
