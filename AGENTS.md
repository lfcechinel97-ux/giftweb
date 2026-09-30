# Regras técnicas

- `set_variantes_por_prefixo` NÃO usa `session_replication_role` — o papel do banco não tem permissão para setar esse parâmetro (erro 42501 no Stage 4 do sync). O gatilho de estoque_total já tem guarda contra recursão.
- `sync-products`: CHUNK_SIZE = 25 (com concorrência 6) — com 150/100 o upsert do Stage 3c não termina dentro do wall-clock da edge function (~25 chunks/s vs ~3,5 chunks/s); sync completo leva ~160s.
- Não alterar código de `importar-pedido-calcme` (deploy com verify_jwt=true validado) nem excluir o secret CALCME_API_TOKEN (recusado pelo usuário).
