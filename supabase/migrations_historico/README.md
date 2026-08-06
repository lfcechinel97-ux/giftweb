# Migrations históricas — documentação, não sincronizado pelo Lovable

Os arquivos desta pasta **já rodaram de verdade** no Supabase de produção
(projeto `ozkbfxvouxgsdthnweyr`), mas foram aplicados fora do fluxo normal
do Lovable Cloud e nunca chegaram a ser salvos em `supabase/migrations/`.

Eles ficam aqui **só para referência/histórico** — fora de
`supabase/migrations/` de propósito, para o pipeline do Lovable não tentar
reaplicá-los (partes do SQL não são idempotentes, ex.: `create type ... as
enum` quebra se o tipo já existir).

Não mover para `supabase/migrations/` sem antes confirmar no painel do
Supabase (Database > Migrations) os timestamps reais de aplicação.

## Ordem de aplicação

1. `05_migration_aditiva.sql` — criou `sistema_fornecedores`,
   `sistema_tecnicas`, `sistema_cotacoes_frete`, buckets `mockups` e
   `cotacoes`, e (nas seções 3 e 6) a tabela `sistema_pedido_itens` com o
   trigger `trg_explodir_itens` de explosão automática do jsonb.
2. `08_fix_producao_satelite.sql` — **substituiu** as seções 3 e 6 do 05:
   removeu `trg_explodir_itens` (conflitava com `aprovarOrcamento()` em
   `src/contexts/SistemaContext.tsx`, que já faz essa conversão em JS) e
   criou a tabela satélite `sistema_producao_itens` (+ `sistema_producao_historico`
   e a view `vw_pcp`), referenciando cada item pelo `id` que já existe
   dentro do array jsonb `sistema_pedidos.itens`.
3. `09_ajusta_status_pcp.sql` — **substituiu o check constraint de status**
   criado pelo 08: os 9 status genéricos (`aguardando_arte`,
   `aguardando_compra`, `fila_producao`, `em_producao`, `enviado_terceiro`,
   `retornou_terceiro`, `conferencia`, `pronto`, `expedido`) viraram 8 status
   reais do fluxo do galpão + `cancelado` (não é coluna do Kanban):
   `organizando_pedido`, `pronto_producao`, `teste_fisico`, `preparacao`,
   `em_producao`, `embalagem_pagamento`, `aguardando_coleta`, `enviado`.
   Também adicionou o checklist (`medidas_ok`, `pagamento_ok`,
   `etiqueta_ok`), `coleta_solicitada_em`, a função `sistema_cor_pedido()`
   e recriou `vw_pcp` com `pedido_cor`, `etapa_desde`, `horas_na_etapa`,
   `total_itens_pedido` e `itens_enviados_pedido`.

**Estado atual válido do banco** = tudo do 05, EXCETO as seções 3 e 6
(substituídas pelo 08), com o status de `sistema_producao_itens` e a view
`vw_pcp` do 08 substituídos pelo 09. `sistema_pedido_itens` pode ainda
existir como tabela órfã (o 08 não a apagou, só parou de alimentá-la) —
não usar para nada novo; a fonte de verdade de produção agora é
`sistema_producao_itens` com o status do 09.
