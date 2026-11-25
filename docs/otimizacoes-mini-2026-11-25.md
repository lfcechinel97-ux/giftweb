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

## Etapa 1 aplicada após aprovação — 25/11, aproximadamente 22:45 UTC

Migration aplicada: `drizzle/migrations/0005_catalog_max_price_visible.sql`, com o SQL apresentado na revisão, sem alterar dados ou permissões. Os 23 índices existentes foram conferidos; nenhum era equivalente. Nenhuma consulta ativa de catálogo/sync foi encontrada no momento da conferência.

`useMaxPrice.ts` usa agora React Query com staleTime e gcTime de 3.600.000 ms. Mantidos filtros, fórmula, arredondamento e fallback. Quatro testes passaram: cálculo, cache antes/depois de 1h, lista vazia e falha não registrada como resultado válido. O setup de testes passou a tolerar ambiente Node para este teste; o ambiente gráfico padrão apresentou um módulo canvas nativo ausente. Nenhuma dependência foi instalada.

### Comparação da consulta isolada

| Métrica | Antes, imediatamente antes da migration | Depois |
|---|---:|---:|
| Execução EXPLAIN ANALYZE | 17,673 ms | 0,168 ms |
| Planejamento | 1,448 ms | 1,578 ms |
| Linhas lidas para obter resultado | 11.289 candidatas + 698 filtradas | 1 |
| Buffers de execução | 4.772 hits | 1 hit + 2 reads |
| Plano | idx_ativo + Sort | Index Only Scan idx_pc_max_price_visible |
| Heap fetches | Não se aplica | 0 |
| Maior preco_base | 608 | 608 |

Redução de aproximadamente 99,0% na execução nesta comparação pontual (~105x); não é percentil de produção. A primeira leitura anterior, de 200,758 ms, ocorreu com condições de cache diferentes e não deve ser usada para prometer ganho constante. Índice novo: 288 kB. Preço calculado pelo hook: 550, preservado.

### Validação real

Navegador em localhost, dados reais: inicial → Buscar Brinde → `/produtos?preco_min=10&preco_max=70` → voltar à inicial. O catálogo terminou de carregar com produtos, uma única consulta de preço máximo em todo o fluxo, retorno preco_base 608 e nenhum erro JavaScript. O botão não direciona a `/busca` quando não há termo textual; o roteiro foi ajustado ao destino real. Build final: OK.

### db_health e slow_queries após etapa 1

| Saúde | Linha de base 21:23 UTC | Após etapa 1 22:46 UTC |
|---|---:|---:|
| Memória | 50% | 49% |
| Disco | 12% | 12% |
| Conexões | 19/60 | 22/60 |
| Clientes do pool | 1/200 | 1/200 |
| Tamanho do banco | 660,2 MB | 660,5 MB |
| WAL | 128 MB | 128 MB |
| Rollbacks desde boot | 3 | 5 |
| Alertas recentes | Nenhum | Nenhum |

O ranking de slow_queries foi repetido sem reset. A consulta de preço máximo acumulou 43 chamadas, média 74,25 ms, máximo 913,50 ms e total 3.192,57 ms; a maioria dessa janela é anterior à alteração. Isso **não** demonstra regressão do índice nem ganho de produção após publicação: o EXPLAIN acima isola o plano novo. A busca antiga acumulou 35 chamadas, média 92,30 ms e máximo 837,60 ms. As consultas de diagnóstico JSONB seguem nas primeiras posições. Nenhuma conclusão sobre CPU instantânea ou causa dos rollbacks históricos foi obtida nesta etapa. O código do site foi salvo para preview; publicação do site não foi solicitada.

## Preparação da etapa 2 — não aplicada

Comparação por **IDs**, não somente contagem, com produtos ativos, com imagem, pais e visíveis; sem filtros opcionais de cor/preço/estoque nesta primeira comparação:

| Termo | nome/descricao | busca | IDs diferentes |
|---|---:|---:|---:|
| caneca | 70 | 70 | 0 |
| caneta | 649 | 649 | 0 |
| chaveiro | 171 | 171 | 0 |
| copo | 160 | 160 | 0 |
| garrafa | 364 | 364 | 0 |
| guarda-chuva | 25 | 25 | 0 |
| inox | 460 | 471 | 11 |
| kit | 295 | 295 | 0 |
| mochila | 207 | 207 | 0 |
| térmica | 376 | 376 | 0 |

A exigência de equivalência não passou para todos os termos; nenhuma busca foi trocada. A versão atual de SearchPage e sua RPC já pesquisam `busca`, enquanto a consulta antiga de nome/descrição com contagem exata foi localizada também em `useHomepageData.ts` (SQUEEZE). Antes do diff final da etapa 2, delimitar os consumidores reais, verificar composição de busca, índices/plano e explicar como usar contagem aproximada sem quebrar paginação; não basta mudar uma opção de contagem em uma RPC que constrói `total_count` internamente.

Recomendação padrão: preservar equivalência com verificação residual depois do filtro indexado, sujeita a comprovar que o filtro `busca` não elimina nenhum ID antigo. A escolha entre preservar resultados ou aceitar os 11 adicionais foi apresentada ao usuário. Etapas 2–8 continuam sem aplicação; relatório final antes/depois de todas as otimizações aguarda essas revisões.