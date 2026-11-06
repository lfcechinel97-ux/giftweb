-- =====================================================================
-- GIFT WEB - O status do PEDIDO acompanha o PCP automaticamente.
--
-- O PCP muda a etapa de cada produto (sistema_producao_itens.status),
-- mas nada repassava isso para sistema_pedidos.status. A lista de Pedidos
-- deduzia a etapa na tela, porém o cabeçalho do pedido, o filtro por
-- status, o prazo vencido, os relatórios e o salvar do formulário usavam o
-- campo gravado, que ficava parado onde o pedido nasceu.
--
-- Regra (a mesma de statusDoPedido em src/pages/sistema/Pedidos.tsx):
-- a etapa do pedido é a do produto MAIS ATRASADO no fluxo do PCP.
-- Produtos cancelados só contam se todos estiverem cancelados. Pedido
-- cancelado não é tocado.
-- =====================================================================

-- Ordem das colunas do Kanban — espelha TODAS_COLUNAS_PCP em
-- src/lib/statusPedido.ts. Coluna fora da lista (ex.: cancelado) vai pro fim.
create or replace function public.sistema_ordem_coluna_pcp(p_coluna text)
returns integer language sql immutable as $$
  select coalesce(array_position(array[
    'organizando_comercial',
    'organizando_pedido',
    'aguardando_mercadoria',
    'teste_fisico',
    'teste_fisico_terceirizada',
    'teste_enviado',
    'em_producao',
    'em_producao_terceirizada',
    'inserir_medidas',
    'aguardando_coleta',
    'enviado'
  ]::text[], p_coluna), 999);
$$;

create or replace function public.sistema_sincronizar_status_pedido(p_pedido_id uuid)
returns void
language plpgsql security definer set search_path = public as $fn$
declare v_status text;
begin
  select pi.status into v_status
    from public.sistema_producao_itens pi
    left join public.sistema_status s on s.slug = pi.status
   where pi.pedido_id = p_pedido_id
     and pi.status is not null
   order by public.sistema_ordem_coluna_pcp(s.coluna_pcp), coalesce(s.ordem, 999), pi.status
   limit 1;

  if v_status is null then return; end if;  -- pedido sem produtos no PCP

  update public.sistema_pedidos
     set status = v_status
   where id = p_pedido_id
     and status is distinct from v_status
     and status is distinct from 'cancelado';
end; $fn$;

revoke all on function public.sistema_sincronizar_status_pedido(uuid) from public, anon;
grant execute on function public.sistema_sincronizar_status_pedido(uuid) to authenticated, service_role;

create or replace function public.sistema_trg_status_pedido_segue_pcp()
returns trigger
language plpgsql security definer set search_path = public as $fn$
begin
  if tg_op = 'DELETE' then
    perform public.sistema_sincronizar_status_pedido(old.pedido_id);
    return old;
  end if;
  perform public.sistema_sincronizar_status_pedido(new.pedido_id);
  if tg_op = 'UPDATE' and old.pedido_id is distinct from new.pedido_id then
    perform public.sistema_sincronizar_status_pedido(old.pedido_id);
  end if;
  return new;
end; $fn$;

drop trigger if exists trg_status_pedido_segue_pcp on public.sistema_producao_itens;
create trigger trg_status_pedido_segue_pcp
  after insert or delete or update of status, pedido_id on public.sistema_producao_itens
  for each row execute function public.sistema_trg_status_pedido_segue_pcp();

-- Backfill: alinha os pedidos que já estão fora de sincronia.
do $$
declare r record;
begin
  for r in select distinct pedido_id from public.sistema_producao_itens where pedido_id is not null loop
    perform public.sistema_sincronizar_status_pedido(r.pedido_id);
  end loop;
end $$;
