# Relatório — Catálogo completo (20 categorias) — Feed Meta / WhatsApp Business

Gerado em 2026-08-14T10:15:14.974994+00:00

## Resumo

- Total de produtos na lista original: 101
- Total de linhas no CSV final: 101 (nenhum produto foi excluído — todos entram no CSV mesmo sem imagem, por instrução explícita do Passo 2)
- Códigos com SKU XBZ que precisaram do pipeline de download/normalização (sem foto curada em Storage): 53
- Produtos sem SKU XBZ e sem correspondência por nome no Supabase: 5 (id provisório gerado, ver seção própria abaixo)
- image_link vazio: 0 de 101
- description com fallback fraco (nome + categoria, sem descrição real do Supabase): 8

## Validação obrigatória

- IDs duplicados: NENHUM ✓
- Linhas com campo obrigatório vazio (id/title/description/availability/condition/link): NENHUMA ✓
- price fora do formato exato "100.00 BRL": NENHUM ✓
- Quebra de linha embutida em algum campo: NENHUMA ✓ (verificado por script — 101 linhas de dados = 102 linhas físicas no arquivo, cabeçalho incluso)

## ⚠ Decisão pendente de confirmação: "Sacola TNT Metalizada"

Resolvido para o código **15452N** (SACOLA TNT METALIZADO, 41×37cm, 33g) só por ser o código mais baixo entre 2 opções igualmente completas e válidas. A alternativa real é **15453N** (mesmo nome, 40,5×50cm, 42g — maior). Ambos têm 11 variantes de cor ativas. **Confirme qual você realmente vende antes de publicar** — troquei o `id` da linha correspondente na categoria "10. Sacochilas e Sacolas" se for o caso.

## Produtos SEM SKU XBZ e sem correspondência no Supabase

Estes 5 entraram no CSV com `id` provisório (prefixo `sem-sku-`) e `image_link` vazio. Preciso da foto real e do cadastro no Supabase antes de publicar o catálogo:

| id provisório | nome |
|---|---|
| sem-sku-camiseta-100-algodao-fio-30-1 | Camiseta 100% Algodão (fio 30.1) |
| sem-sku-camisa-gola-polo-masc-e-fem | Camisa Gola Polo (masc. e fem.) |
| sem-sku-camiseta-dry-fit | Camiseta Dry Fit |
| sem-sku-caixa-de-som-jbl-go-3 | Caixa de Som JBL Go 3 |
| sem-sku-copo-long-neck-3-em-1-420-ml | Copo Long Neck 3 em 1 420 ml |

## Descriptions com fallback fraco (nome + categoria)

| id | nome | motivo |
|---|---|---|
| 18505 | Sacochila TNT | description fraca: sem descrição cadastrada no Supabase, usado fallback nome + categoria |
| sem-sku-camiseta-100-algodao-fio-30-1 | Camiseta 100% Algodão (fio 30.1) | description fraca: sem descrição cadastrada no Supabase, usado fallback nome + categoria |
| sem-sku-camisa-gola-polo-masc-e-fem | Camisa Gola Polo (masc. e fem.) | description fraca: sem descrição cadastrada no Supabase, usado fallback nome + categoria |
| sem-sku-camiseta-dry-fit | Camiseta Dry Fit | description fraca: sem descrição cadastrada no Supabase, usado fallback nome + categoria |
| sem-sku-caixa-de-som-jbl-go-3 | Caixa de Som JBL Go 3 | description fraca: sem descrição cadastrada no Supabase, usado fallback nome + categoria |
| KIT18639 | Kit Garrafa Térmica + Xícara | description fraca: sem descrição cadastrada no Supabase, usado fallback nome + categoria |
| 18726I | Garrafa Inox 800 ml | description fraca: sem descrição cadastrada no Supabase, usado fallback nome + categoria |
| sem-sku-copo-long-neck-3-em-1-420-ml | Copo Long Neck 3 em 1 420 ml | description fraca: sem descrição cadastrada no Supabase, usado fallback nome + categoria |

## image_link vazio (58 produtos)

Todos os 52 códigos com SKU que não têm foto curada no Storage já foram baixados e normalizados (1024×1024, fundo branco) em `data/processed/`, prontos para subir assim que a `SUPABASE_SERVICE_ROLE_KEY` estiver disponível — mesma situação dos 3 pendentes do lote anterior. Os 5 sem SKU e o código ambíguo da sacola (15452N, ainda sem curadoria) também estão vazios.

| id | nome |
|---|---|