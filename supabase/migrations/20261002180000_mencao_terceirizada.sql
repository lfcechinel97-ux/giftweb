-- =====================================================================
-- GIFT WEB - sistema_nomes_usuarios() passa a incluir também os logins
-- de terceirizada (nome = nome da terceirizada, ex. "Flex Varejo") -- é
-- a mesma lista usada pelo autocomplete de @menção nos dois sistemas,
-- então isso sozinho já permite @mencionar uma terceirizada de dentro
-- do PCP interno (ex.: digitar "@flex", escolher "Flex Varejo" na lista).
-- =====================================================================
create or replace function public.sistema_nomes_usuarios()
returns table (user_id uuid, nome text)
language sql stable security definer set search_path = public as $$
  select a.id, coalesce(nullif(trim(a.nome), ''), a.email) as nome
    from public.admin_users a
  union all
  select u.auth_user_id, f.nome
    from public.sistema_terceirizada_usuarios u
    join public.sistema_fornecedores f on f.id = u.terceirizada_id
   where u.ativo
$$;

revoke all on function public.sistema_nomes_usuarios() from public, anon;
grant execute on function public.sistema_nomes_usuarios() to authenticated;
