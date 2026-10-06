-- =====================================================================
-- GIFT WEB - Busca da página de Pedidos no servidor, numa função só:
-- nº do pedido, cliente (cadastro: nome e documento; ou o nome gravado no
-- pedido), contato (nome, e-mail, telefone) e PRODUTO (nome/código de
-- qualquer item). Ignora maiúscula e acento ("joao" acha "João").
-- Devolve só os ids; o resto (vendedor, status, datas, aba, paginação)
-- continua sendo filtrado na consulta normal da tela.
-- =====================================================================

create or replace function public.sistema_sem_acento(t text)
returns text
language sql immutable
set search_path = public
as $$
  select lower(translate(coalesce(t, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'));
$$;

create or replace function public.sistema_buscar_pedidos(p_termo text)
returns setof uuid
language plpgsql stable
security definer
set search_path = public
as $$
declare
  v text := '%' || public.sistema_sem_acento(trim(coalesce(p_termo, ''))) || '%';
  v_digitos text := regexp_replace(coalesce(p_termo, ''), '\D', '', 'g');
begin
  if not public.is_admin_user() then
    raise exception 'Not authorized';
  end if;
  if trim(coalesce(p_termo, '')) = '' then return; end if;

  return query
  select p.id
    from public.sistema_pedidos p
    left join public.sistema_clientes c on c.id = p.cliente_id
   where public.sistema_sem_acento(p.numero) like v
      or public.sistema_sem_acento(p.contato_nome) like v
      or public.sistema_sem_acento(p.contato_email) like v
      or public.sistema_sem_acento(p.contato_telefone) like v
      or public.sistema_sem_acento(p.cliente_snapshot->>'nome') like v
      or public.sistema_sem_acento(c.nome) like v
      or (length(v_digitos) >= 4 and (
            regexp_replace(coalesce(c.documento, ''), '\D', '', 'g') like '%' || v_digitos || '%'
         or regexp_replace(coalesce(p.cliente_snapshot->>'documento', ''), '\D', '', 'g') like '%' || v_digitos || '%'
         or regexp_replace(coalesce(p.contato_telefone, ''), '\D', '', 'g') like '%' || v_digitos || '%'))
      or exists (
        select 1 from jsonb_array_elements(case when jsonb_typeof(p.itens) = 'array' then p.itens else '[]'::jsonb end) i
         where public.sistema_sem_acento(i->>'nome') like v
            or public.sistema_sem_acento(i->>'codigoComposto') like v
      )
   -- Teto: os ids voltam na URL da consulta da tela; busca que acha mais
   -- que isso é genérica demais pra ser útil mesmo.
   order by p.created_at desc
   limit 400;
end;
$$;

revoke execute on function public.sistema_buscar_pedidos(text) from public, anon;
grant execute on function public.sistema_buscar_pedidos(text) to authenticated;

notify pgrst, 'reload schema';
