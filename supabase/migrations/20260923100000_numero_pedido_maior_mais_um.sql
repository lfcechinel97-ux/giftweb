-- =====================================================================
-- GIFT WEB - Número automático do pedido = maior número existente + 1.
--
-- O número pode ser trocado à mão no pedido; o próximo automático segue
-- sempre um a mais que o maior já usado (se alguém colocar 100700 à
-- mão, o próximo sai 100701). Sem nenhum pedido, começa em 100621.
-- Um lock de transação evita que dois pedidos criados ao mesmo tempo
-- recebam o mesmo número.
-- =====================================================================

create or replace function public.sistema_next_pedido_numero()
returns text
language plpgsql
volatile
security definer
set search_path to 'public'
as $$
declare v_proximo bigint;
begin
  if not public.is_admin_user() then
    raise exception 'Not authorized';
  end if;

  perform pg_advisory_xact_lock(hashtext('sistema_next_pedido_numero'));

  select coalesce(max(numero::bigint), 100620) + 1
    into v_proximo
  from public.sistema_pedidos
  where numero ~ '^[0-9]{1,15}$';

  return v_proximo::text;
end;
$$;

revoke execute on function public.sistema_next_pedido_numero() from public, anon;
grant execute on function public.sistema_next_pedido_numero() to authenticated, service_role;
