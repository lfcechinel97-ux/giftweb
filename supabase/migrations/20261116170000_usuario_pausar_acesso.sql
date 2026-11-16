-- =====================================================================
-- Pausar o acesso de um usuário ao sistema sem apagá-lo.
-- Usuário pausado: o login é recusado (front) e TODAS as regras do banco
-- passam a tratá-lo como sem acesso (is_admin_user / has_role / is_gestor
-- devolvem false), então mesmo uma sessão já aberta para de ler/gravar.
-- Reativar devolve tudo como estava (papel e vendedores ficam guardados).
-- =====================================================================

alter table public.admin_users
  add column if not exists pausado boolean not null default false;

create or replace function public.is_admin_user()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_users where id = auth.uid() and not pausado);
$$;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
     and not exists (select 1 from public.admin_users where id = _user_id and pausado);
$$;

create or replace function public.is_gestor(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role::text in ('admin', 'gerente')
  ) and not exists (select 1 from public.admin_users where id = _user_id and pausado);
$$;

-- Pausar / reativar (só admin; ninguém pausa a si mesmo).
create or replace function public.sistema_pausar_usuario(p_user_id uuid, p_pausado boolean)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Apenas administradores podem gerenciar usuários.';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Você não pode pausar seu próprio acesso.';
  end if;
  update public.admin_users set pausado = coalesce(p_pausado, false) where id = p_user_id;
end;
$$;
revoke all on function public.sistema_pausar_usuario(uuid, boolean) from public, anon;
grant execute on function public.sistema_pausar_usuario(uuid, boolean) to authenticated;

-- Lista de usuários passa a devolver se está pausado.
drop function if exists public.sistema_listar_usuarios();
create function public.sistema_listar_usuarios()
returns table (user_id uuid, email text, nome text, papel text, vendedor_id uuid, created_at timestamptz, vendedores_extras uuid[], pausado boolean)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Apenas administradores podem ver os usuários.';
  end if;
  return query
    select a.id, a.email, a.nome,
      case when exists (select 1 from public.user_roles r where r.user_id = a.id and r.role::text = 'admin') then 'admin'
           when exists (select 1 from public.user_roles r where r.user_id = a.id and r.role::text = 'gerente') then 'gerente'
           when exists (select 1 from public.user_roles r where r.user_id = a.id and r.role::text = 'producao') then 'producao'
           else 'vendedor' end,
      a.vendedor_id, a.created_at, coalesce(a.vendedores_extras, '{}'::uuid[]), a.pausado
    from public.admin_users a
    order by a.pausado, a.nome nulls last, a.email;
end;
$$;
revoke all on function public.sistema_listar_usuarios() from public, anon;
grant execute on function public.sistema_listar_usuarios() to authenticated;
