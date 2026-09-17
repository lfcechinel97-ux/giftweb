-- =====================================================================
-- GIFT WEB - Reduz a carga de replicacao do Realtime.
--
-- A instancia do projeto e "Tiny" (CPU compartilhada, 0,5 GB RAM). A
-- migration anterior (20260917130000) ligou REPLICA IDENTITY FULL nas 3
-- tabelas do PCP para o Realtime funcionar -- mas FULL faz o Postgres
-- gravar a LINHA INTEIRA (antes e depois) no WAL a cada UPDATE, nao so a
-- chave primaria. Numa instancia pequena, uma sequencia de updates em
-- lote (como o board de producao faz o tempo todo: mudar status, tags,
-- checklist) sobrecarrega o WAL rapido. O projeto ficou fora do ar horas
-- depois dessa migration ter rodado -- REPLICA IDENTITY FULL e a causa
-- mais provavel.
--
-- DEFAULT basta: o codigo (src/pages/sistema/PCP.tsx) so le `payload.old`
-- no evento DELETE, so pra pegar o `.id` -- e a PRIMARY KEY, que
-- REPLICA IDENTITY DEFAULT ja inclui em todo evento UPDATE/DELETE. Nao
-- perde nenhuma funcionalidade, so o excesso de dado replicado.
-- =====================================================================

alter table public.sistema_producao_itens     replica identity default;
alter table public.sistema_producao_historico replica identity default;
alter table public.sistema_pedidos            replica identity default;

-- =====================================================================
-- Contagem das abas de Pedidos ja agregada no servidor.
--
-- src/pages/sistema/Pedidos.tsx trazia `select status` de TODOS os
-- pedidos e contava na tela -- hoje sao so 44 linhas (barato), mas cresce
-- sem limite e nunca teve corte. count(*) group by no banco devolve so
-- uma linha por coluna do board (no maximo 8), nao uma por pedido.
-- =====================================================================
create or replace function public.sistema_contar_pedidos_por_coluna()
returns table (coluna_pcp text, total bigint)
language sql
stable security definer
set search_path to 'public'
as $function$
  select s.coluna_pcp, count(*)::bigint as total
  from public.sistema_pedidos p
  join public.sistema_status s on s.slug = p.status
  group by s.coluna_pcp;
$function$;

grant execute on function public.sistema_contar_pedidos_por_coluna()
  to authenticated, service_role;
