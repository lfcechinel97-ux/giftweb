-- Um orçamento gera UM pedido só (o front já trava; isto garante no banco,
-- inclusive com duas abas/dois cliques ao mesmo tempo).
-- Se já existirem orçamentos com pedido duplicado, o índice não é criado
-- (para não travar a migration): exclua os duplicados e rode de novo.
do $$
begin
  if exists (
    select 1 from public.sistema_pedidos
    where orcamento_id is not null
    group by orcamento_id having count(*) > 1
  ) then
    raise notice 'Há orçamentos com mais de um pedido; índice único NÃO criado. Exclua os duplicados e rode de novo.';
  else
    create unique index if not exists sistema_pedidos_um_por_orcamento
      on public.sistema_pedidos (orcamento_id)
      where orcamento_id is not null;
  end if;
end $$;
