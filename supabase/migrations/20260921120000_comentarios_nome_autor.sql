-- =====================================================================
-- GIFT WEB - Observações do PCP mostram o NOME de quem escreveu, não o
-- e-mail. O nome sai do cadastro do usuário (Configurações > Usuários)
-- ou, se estiver vazio, do vendedor vinculado a ele. Preenchido pelo
-- banco no insert, então não depende da tela mandar certo.
-- =====================================================================

alter table public.sistema_producao_comentarios add column if not exists autor_nome text;

create or replace function public.sistema_comentario_preenche_autor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.autor_nome is null and new.autor_id is not null then
    select coalesce(nullif(trim(a.nome), ''), v.nome)
      into new.autor_nome
    from public.admin_users a
    left join public.sistema_vendedores v on v.id = a.vendedor_id
    where a.id = new.autor_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_comentario_preenche_autor on public.sistema_producao_comentarios;
create trigger trg_comentario_preenche_autor
  before insert on public.sistema_producao_comentarios
  for each row execute function public.sistema_comentario_preenche_autor();

-- Observações antigas
update public.sistema_producao_comentarios c
set autor_nome = coalesce(nullif(trim(a.nome), ''), v.nome)
from public.admin_users a
left join public.sistema_vendedores v on v.id = a.vendedor_id
where c.autor_nome is null
  and (a.id = c.autor_id or lower(a.email) = lower(c.autor_email));
