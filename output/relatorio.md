# Relatório — Feed Meta (catálogo WhatsApp) — XBZ Brindes

Gerado em 2026-08-12T16:58:43.706540+00:00

## Resumo

- Total de códigos processados: 43
- Total de linhas no CSV final: 40
- Total de códigos excluídos: 3

## Observações gerais

- additional_image_link foi deixado vazio para todos os produtos - decisão do usuário: preencher só após revisão manual em output/revisao_imagens.html (não existe 'foto coletiva com todas as cores' em nenhuma fonte de dado real, API ou curadoria).
- Campo 'material' deixado vazio para todos os produtos: nenhuma fonte (products_cache ou topprodutos_curadoria) tem uma coluna estruturada de material; o texto da descrição já menciona material quando a API/curadoria o informa em prosa.
- price = products_cache.preco_custo × multiplicador escalonado do product-feed do site (mesma fórmula do feed do Google) × (1 - 16%).
- SUPABASE_SERVICE_ROLE_KEY não estava configurada nesta execução: imagens novas (códigos sem curadoria) foram baixadas e normalizadas em data/processed/ mas NÃO enviadas ao bucket catalogo-meta - por isso ficaram sem image_link válido e saíram do CSV.

## Códigos excluídos do CSV

| Código | Motivo |
|---|---|
| 08103 | campo obrigatório 'image_link' vazio |
| 14728P | campo obrigatório 'image_link' vazio |
| 18505 | campo obrigatório 'image_link' vazio |

## Avisos (produto incluído no CSV, mas com ressalva)

| Código | Aviso |
|---|---|
| 04098B | Sem página de produto ativa para '04098B' (slug='garrafa-termica-630ml-04098b', ativo=False); usando URL de categoria |
| 06033 | preco_custo do produto pai ausente; usado valor das variantes de cor (36.9) |
| 02082N | Sem página de produto ativa para '02082N' (slug='sacola-de-tnt-sem-alca-02082n', ativo=False); usando URL de categoria |
| 07447 | topprodutos_curadoria sem 'Medidas de gravação' na descricao_longa |
| 12487F | Sem página de produto ativa para '12487F' (slug='squeeze-aluminio-fosco-650ml-12487f', ativo=False); usando URL de categoria |
| 14794 | preco_custo do produto pai ausente; usado valor mais comum entre variantes (17.6), mas variantes de cor têm custos DIFERENTES entre si [17.6, 26.0] - conferir manualmente |
| 17011F | Sem página de produto ativa para '17011F' (slug='garrafa-750ml-inox-tampa-preta-17011f', ativo=False); usando URL de categoria |
| 9139i | Sem página de produto ativa para '9139i' (slug='squeeze-inox-500ml-c-bico-e-mosquetao-9139i', ativo=False); usando URL de categoria |
| ER143B | Sem página de produto ativa para 'ER143B' (slug='caneta-metal-er143b', ativo=False); usando URL de categoria |
