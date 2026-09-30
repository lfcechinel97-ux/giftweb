-- 1) Quantos produtos existem e quantos estão ATIVOS
select
  count(*) as total,
  count(*) filter (where ativo) as ativos,
  count(*) filter (where not ativo) as inativos
from public.products_cache;

-- 2) Existe "copo térmico" na base, mesmo que inativo?
select codigo_amigavel, nome, ativo, ultima_sync
from public.products_cache
where nome ilike '%copo%termi%' or busca ilike '%copo%termi%'
order by ultima_sync desc nulls last
limit 10;

-- 3) Últimas sincronizações (sucesso/erro e quantos produtos cada uma trouxe)
select id, synced_at, status, total_products, erro
from public.sync_log
order by synced_at desc
limit 10;

-- 4) O índice de busca continua existindo?
select indexname, indexdef
from pg_indexes
where tablename = 'products_cache' and indexname ilike '%busca%';

-- 5) NÃO RODAR NO SQL EDITOR: a função exige um usuário logado (auth.uid()),
-- que só existe quando é o próprio site chamando. Aqui sempre vai dar
-- "Not authorized" -- não é um erro de verdade, é só a proteção funcionando.
