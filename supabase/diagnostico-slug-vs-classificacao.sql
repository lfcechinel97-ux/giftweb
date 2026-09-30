-- Confere se o STATUS (slug) do item já bate com a classificação real
-- (local_producao/tag), só para os itens em "A Produzir" (coluna em_producao).
-- Se toda linha tiver "bate" = ok, a migração só precisa realocar
-- coluna_pcp por slug, sem tocar em nenhum item. Se aparecer "NAO bate",
-- listo os itens para decidirmos.
select
  pi.status,
  case
    when pi.local_producao = 'terceirizada'
      or exists (select 1 from unnest(pi.tags) t where upper(t) like 'TERCEIRIZADA%') then 'terceirizada'
    else 'galpao'
  end as classificacao_real,
  case
    when pi.status = 'a_produzir_terceirizada' and (
      pi.local_producao = 'terceirizada'
      or exists (select 1 from unnest(pi.tags) t where upper(t) like 'TERCEIRIZADA%')
    ) then 'bate'
    when pi.status = 'a_produzir' and not (
      pi.local_producao = 'terceirizada'
      or exists (select 1 from unnest(pi.tags) t where upper(t) like 'TERCEIRIZADA%')
    ) then 'bate'
    else 'NAO bate'
  end as slug_vs_classificacao,
  count(*) as itens
from public.sistema_producao_itens pi
join public.sistema_status s on s.slug = pi.status
where s.coluna_pcp = 'em_producao'
group by 1, 2, 3
order by 3, 1;
