## Problema

A busca de produtos no modal "Adicionar Item" usa `ILIKE '%termo inteiro%'`, então frases com mais de uma palavra (ex: "sacola em tnt", "garrafa led") só batem se a sequência exata existir no nome. Em produção isso significa:

- "sacola em tnt" → 0 resultados (mas 155 produtos contêm "sacola" + "tnt")
- "garrafa led" → não encontra "Garrafa Squeeze LED"
- A demora vem do `ILIKE` em `nome`/`codigo_amigavel` sem índice trigram (índice trgm só existe em `busca`).

## Plano

### 1. Reescrever `sistema_search_products` (migration)
- Quebrar o termo em palavras (split por espaços, ignorar tokens < 2 chars).
- Aplicar **AND** entre os tokens, casando contra `busca` (que já concatena nome + código + cor + categoria + sinônimos e tem índice GIN trgm).
- Para um único token curto/código, também testar `codigo_amigavel`.
- Ordenar por relevância simples: produtos cujo `nome` começa com o termo primeiro, depois ordem alfabética.
- Manter o agrupamento por `group_key` (1 representante por prefixo) e o limite/paginação existentes.

### 2. Garantir velocidade
- `idx_pc_sistema_busca_trgm` (já existe) cobre o ILIKE em `busca`. Confirmar que o plano usa GIN — sem novo índice necessário.
- Remover o ILIKE em `nome` e `codigo_amigavel` quando houver mais de um token (já coberto via `busca`).

### 3. Frontend (`useSistemaProducts.ts` / modal de busca)
- Aumentar debounce mínimo se necessário, mas manter UX rápida (300 ms).
- Subir `p_page_size` default para 60 e remover o cap de 100 no RPC para 200, permitindo mais resultados quando o termo é genérico.
- Mostrar "Nenhum produto encontrado" quando o RPC retorna 0 (já existe), mantendo "Carregando produtos..." apenas durante fetch.

### 4. Verificação
- Rodar SQL: `sistema_search_products('sacola em tnt')` deve retornar > 0.
- Testar no preview: "garrafa led", "sacola tnt", "caneta metal".

## Detalhes técnicos

Nova cláusula WHERE (resumida):

```sql
WITH tokens AS (
  SELECT array_agg(t) AS arr
  FROM unnest(string_to_array(lower(v_term), ' ')) t
  WHERE length(t) >= 2
)
... WHERE pc.ativo = true
  AND (
    v_term IS NULL
    OR (
      SELECT bool_and(pc.busca ILIKE '%' || tk || '%')
      FROM unnest((SELECT arr FROM tokens)) tk
    )
    OR pc.codigo_amigavel ILIKE '%' || v_term || '%'
  )
```

Sem mudanças de RLS ou de outras tabelas.
