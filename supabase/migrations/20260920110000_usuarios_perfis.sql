-- =====================================================================
-- GIFT WEB - Usuários com perfil: ADMIN, COMERCIAL (role 'vendedor') e
-- PRODUÇÃO. Acesso ao /sistema continua sendo "estar em admin_users";
-- o papel em user_roles decide o que cada um vê (resultado, custos e
-- despesas só para admin).
--
-- A conta de login é criada pelo próprio app (signUp, com confirmação
-- automática ligada no projeto); estas funções só autorizam a conta e
-- definem o papel, e só um admin pode chamá-las.
-- =====================================================================

alter table public.admin_users add column if not exists nome text;
alter table public.admin_users add column if not exists vendedor_id uuid
  references public.sistema_vendedores(id) on delete set null;

insert into public.user_roles (user_id, role)
select id, 'admin'::public.app_role from public.admin_users
where lower(email) = 'lfcechinel97@gmail.com'
on conflict do nothing;

-- Perfil de quem está logado.
create or replace function public.sistema_meu_perfil()
returns table (user_id uuid, email text, nome text, papel text, vendedor_id uuid)
language sql stable security definer set search_path = public
as $$
  select a.id, a.email, a.nome,
    case when public.has_role(a.id, 'admin') then 'admin'
         when public.has_role(a.id, 'producao') then 'producao'
         else 'vendedor' end,
    a.vendedor_id
  from public.admin_users a
  where a.id = auth.uid();
$$;

create or replace function public.sistema_listar_usuarios()
returns table (user_id uuid, email text, nome text, papel text, vendedor_id uuid, created_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Apenas administradores podem ver os usuários.';
  end if;
  return query
    select a.id, a.email, a.nome,
      case when public.has_role(a.id, 'admin') then 'admin'
           when public.has_role(a.id, 'producao') then 'producao'
           else 'vendedor' end,
      a.vendedor_id, a.created_at
    from public.admin_users a
    order by a.nome nulls last, a.email;
end;
$$;

-- Autoriza (ou atualiza) uma conta de login existente, localizada pelo e-mail.
create or replace function public.sistema_salvar_usuario(
  p_email text, p_nome text, p_papel public.app_role, p_vendedor_id uuid default null
)
returns uuid
language plpgsql security definer set search_path = public, auth
as $$
declare v_id uuid; v_email text;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Apenas administradores podem gerenciar usuários.';
  end if;

  select u.id, u.email into v_id, v_email
  from auth.users u where lower(u.email) = lower(trim(p_email));
  if v_id is null then
    raise exception 'Nenhuma conta de login com o e-mail %.', p_email;
  end if;

  if v_id = auth.uid() and p_papel <> 'admin' then
    raise exception 'Você não pode tirar seu próprio acesso de administrador.';
  end if;

  insert into public.admin_users (id, email, nome, vendedor_id)
  values (v_id, v_email, nullif(trim(p_nome), ''), p_vendedor_id)
  on conflict (id) do update
    set email = excluded.email, nome = excluded.nome, vendedor_id = excluded.vendedor_id;

  delete from public.user_roles where user_id = v_id;
  insert into public.user_roles (user_id, role) values (v_id, p_papel);

  return v_id;
end;
$$;

-- Tira o acesso ao sistema (a conta de login continua existindo, mas não entra mais).
create or replace function public.sistema_remover_usuario(p_user_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'Apenas administradores podem gerenciar usuários.';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Você não pode remover seu próprio acesso.';
  end if;
  delete from public.user_roles where user_id = p_user_id;
  delete from public.admin_users where id = p_user_id;
end;
$$;

revoke all on function public.sistema_meu_perfil() from public, anon;
revoke all on function public.sistema_listar_usuarios() from public, anon;
revoke all on function public.sistema_salvar_usuario(text, text, public.app_role, uuid) from public, anon;
revoke all on function public.sistema_remover_usuario(uuid) from public, anon;
grant execute on function public.sistema_meu_perfil() to authenticated;
grant execute on function public.sistema_listar_usuarios() to authenticated;
grant execute on function public.sistema_salvar_usuario(text, text, public.app_role, uuid) to authenticated;
grant execute on function public.sistema_remover_usuario(uuid) to authenticated;
