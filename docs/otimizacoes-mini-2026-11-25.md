# Otimizações após Mini — linha de base

Coleta em 25/11/2026, aproximadamente 21:23 UTC. Nenhuma otimização aplicada nesta coleta.

## Saúde

- Banco e pool de conexões disponíveis.
- Memória: 50%; disco de dados: 12%.
- Conexões: 19/60; clientes do pool: 1/200.
- Banco: 660,2 MB; WAL: 128 MB.
- Reinícios desde boot: 0; rollbacks desde boot: 3.
- Sem alertas recentes de exaustão após o redimensionamento.
- CPU e I/O instantâneos não são fornecidos por este snapshot.

## Preço máximo antes da otimização

Consulta com os filtros exatos de `src/hooks/useMaxPrice.ts`:

```sql
SELECT preco_base
FROM public.products_cache
WHERE ativo = true
  AND has_image = true
  AND (is_hidden IS NULL OR is_hidden = false)
  AND preco_base > 0
ORDER BY preco_base DESC
LIMIT 1;
```

EXPLAIN ANALYZE: 200,758 ms de execução; 27,899 ms de planejamento. Index Scan em idx_ativo, seguido de ordenação; 11.289 linhas candidatas, 698 removidas pelo filtro. Medição única, não representa percentil de produção. Repetir com BUFFERS antes/depois quando a etapa for aprovada.

`slow_queries`: a chamada da aplicação para preço máximo teve 5 execuções, média 67,57 ms, máximo 222,55 ms e total 337,85 ms desde o reset das estatísticas.

Outras consultas da aplicação nesta janela:

| Consulta | Chamadas | Média ms | Máximo ms | Total ms |
|---|---:|---:|---:|---:|
| Busca nome/descrição com contagem exata | 4 | 51,32 | 64,17 | 205,29 |
| Produtos por categoria, linha completa | 38 | 1,39 | 7,38 | 52,93 |
| Categoria por produto para agregação no cliente | 4 | 6,54 | 14,03 | 26,16 |

As duas primeiras consultas no ranking foram desta investigação: leitura de tamanho de JSONB (4.767,31 ms) e enumeração de chaves JSONB (3.536,78 ms). Não atribuir esses custos à navegação de usuários. Estatísticas recentes são cumulativas e não podem ser comparadas por total bruto sem considerar número de chamadas e janela.

## Descobertas iniciais, ainda sem correções

- `SearchPage.tsx` já usa `search_products_global`; a consulta de cores já usa `busca`. Localizar a consulta antiga e inspecionar a RPC ao preparar a etapa 2, em vez de substituir a página por uma consulta direta.
- Não foi encontrado índice em `preco_base` na consulta de índices por nome contendo `preco`; o resultado contém apenas idx_pc_preco_custo. Conferir todos os índices antes da aplicação.
- `trello-lembretes` continua `* * * * *`: 1.440 execuções/dia; proposta `*/15 * * * *`: 96/dia.
- Orçamentos: 773 registros, 158 com itens acima de 100 KB e 91 acima de 1 MB; máximo 26.010.877 bytes e média 628.664 bytes. Relação total 526 MB, dos quais 524 MB são índices/armazenamento externo.
- Mídia base64 foi confirmada em `itens[].imagem` e `itens[].mockupImagem`, por vezes duplicada no mesmo item. Mapeamento completo e proposta de Storage ainda pendentes; nenhum dado foi migrado.
- `pg_stat_database` apresentou inicialmente 869 commits e 2 rollbacks; o snapshot seguinte apresentou 3 rollbacks desde boot. Isso não identifica a origem histórica dos ~84 mil: investigar logs e momento do reset, sem atribuir uma causa ainda.

## Processo de aplicação

Cada etapa terá diff/migration próprio para revisão antes de aplicação, validação correspondente e registro de resultados. Preservar filtros, preços, permissões e consumidores existentes. Não migrar mídia e não redimensionar novamente.