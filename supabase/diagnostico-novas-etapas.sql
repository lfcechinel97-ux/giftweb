-- =====================================================================
-- Diagnóstico para as 2 novas etapas (Aguardando Teste Terceirizada,
-- A Produzir Terceirizada). Só LEITURA — nada aqui altera dado ou schema.
-- =====================================================================

-- 1) Quantos itens hoje em cada coluna do PCP
select s.coluna_pcp, count(*) as itens
from public.sistema_producao_itens pi
join public.sistema_status s on s.slug = pi.status
group by 1 order by 2 desc;

-- 2) Em "Aguardando Teste" (teste_fisico) e "A Produzir" (em_producao):
--    quantos são Galpão vs Terceirizada vs "não dá pra saber"
select
  s.coluna_pcp,
  case
    when pi.local_producao = 'terceirizada'
      or exists (select 1 from unnest(pi.tags) t where upper(t) like 'TERCEIRIZADA%') then 'terceirizada'
    when pi.local_producao = 'interna'
      or exists (select 1 from unnest(pi.tags) t where upper(t) = 'PROD. GALPÃO') then 'galpao'
    else 'indefinido'
  end as classificacao,
  count(*) as itens
from public.sistema_producao_itens pi
join public.sistema_status s on s.slug = pi.status
where s.coluna_pcp in ('teste_fisico', 'em_producao')
group by 1, 2
order by 1, 2;

-- 2b) Lista os itens "indefinido" acima (se houver) para decidir manualmente
select p.numero, pi.id as producao_id, pi.status, pi.local_producao, pi.tags,
       e.value ->> 'nome' as produto
from public.sistema_producao_itens pi
join public.sistema_status s on s.slug = pi.status
join public.sistema_pedidos p on p.id = pi.pedido_id
cross join lateral jsonb_array_elements(p.itens) e(value)
where s.coluna_pcp in ('teste_fisico', 'em_producao')
  and (e.value ->> 'id') = pi.item_id::text
  and pi.local_producao not in ('terceirizada', 'interna', 'fornecedor_para_terceirizada')
  and not exists (select 1 from unnest(pi.tags) t where upper(t) like 'TERCEIRIZADA%' or upper(t) = 'PROD. GALPÃO')
order by p.numero;

-- 3) Valores de local_producao realmente em uso (esperado: interna,
--    terceirizada, fornecedor_para_terceirizada -- qualquer outro é
--    surpresa)
select local_producao, count(*) from public.sistema_producao_itens group by 1 order by 2 desc;

-- 4) Status nulos ou fora do catálogo (não deveria existir, é só rede de segurança)
select pi.status, count(*)
from public.sistema_producao_itens pi
left join public.sistema_status s on s.slug = pi.status
where s.slug is null
group by 1;

-- 5) O CHECK atual de sistema_status.coluna_pcp (confirma se
--    'em_producao_terceirizada' já está liberado, como o histórico sugere)
select conname, pg_get_constraintdef(oid)
from pg_constraint
where conrelid = 'public.sistema_status'::regclass and contype = 'c';

-- 6) sistema_status: linhas atuais (slug, coluna_pcp, ordem, protegido)
select slug, nome, coluna_pcp, ordem, escopo, protegido, ativo
from public.sistema_status
order by ordem;
