-- =====================================================================
-- GIFT WEB - Trello: cada colaborador tem o seu; gestor (admin ou
-- gerente, regra do AGENTS.md) vê e escreve no de todos.
--
-- 1) trello_tem_acesso() passa a liberar is_gestor(). Como TODAS as
--    policies do Trello (quadros, colunas, cartões, etiquetas, checklist,
--    anexos, comentários e storage) passam por ela, o gestor ganha
--    leitura e escrita em tudo de uma vez. Excluir quadro continua só
--    para o dono. Lembretes e notificações seguem pessoais.
-- 2) Gestor pode criar quadro PARA um colaborador (owner_id = ele).
-- 3) Avisos no sino: comentário novo avisa dono do quadro, responsável e
--    quem já comentou no cartão (menos o autor) — assim a resposta do
--    colaborador volta para quem perguntou. Cartão criado por outra
--    pessoa no quadro de alguém avisa o dono (e o responsável).
--
-- Para liberar só ao ADMIN (sem gerente), troque is_gestor(auth.uid())
-- por has_role(auth.uid(), 'admin') nas duas funções/policy abaixo.
-- Idempotente.
-- =====================================================================

-- 1) Acesso
create or replace function public.trello_tem_acesso(p_board uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_gestor(auth.uid())
  or exists (
    select 1 from public.trello_boards b
     where b.id = p_board and b.owner_id = auth.uid()
  ) or exists (
    select 1 from public.trello_board_members m
     where m.board_id = p_board and m.user_id = auth.uid()
  );
$$;

-- 2) Criar quadro: o próprio colaborador, ou o gestor para um colaborador.
drop policy if exists "trello boards insert" on public.trello_boards;
create policy "trello boards insert" on public.trello_boards
  for insert to authenticated with check (
    (owner_id = auth.uid() and public.is_admin_user())
    or (public.is_gestor(auth.uid()) and exists (select 1 from public.admin_users a where a.id = owner_id))
  );

-- 3) Avisos no sino
create or replace function public.trello_nome_usuario(p_user uuid)
returns text
language sql stable security definer set search_path = public
as $$
  select coalesce(
    (select coalesce(nullif(trim(a.nome), ''), split_part(a.email, '@', 1))
       from public.admin_users a where a.id = p_user),
    'Alguém');
$$;
revoke all on function public.trello_nome_usuario(uuid) from public, anon;

create or replace function public.trello_notificar_comentario()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_card  public.trello_cards%rowtype;
  v_dono  uuid;
  v_autor text;
begin
  select * into v_card from public.trello_cards where id = new.card_id;
  if not found then return new; end if;
  select owner_id into v_dono from public.trello_boards where id = v_card.board_id;
  v_autor := public.trello_nome_usuario(new.user_id);

  insert into public.trello_notifications (user_id, card_id, title, body)
  select distinct d.uid, new.card_id,
         v_autor || ' comentou em "' || left(v_card.title, 80) || '"',
         left(new.text, 200)
    from (
      select v_dono as uid
      union select v_card.assignee_id
      union select c.user_id from public.trello_comments c where c.card_id = new.card_id
    ) d
   where d.uid is not null
     and d.uid <> new.user_id;
  return new;
end;
$$;

drop trigger if exists trello_notificar_comentario on public.trello_comments;
create trigger trello_notificar_comentario
  after insert on public.trello_comments
  for each row execute function public.trello_notificar_comentario();

create or replace function public.trello_notificar_cartao_novo()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_dono   uuid;
  v_quadro text;
begin
  if new.created_by is null then return new; end if;
  select owner_id, title into v_dono, v_quadro from public.trello_boards where id = new.board_id;

  insert into public.trello_notifications (user_id, card_id, title, body)
  select distinct d.uid, new.id,
         public.trello_nome_usuario(new.created_by) || ' criou um cartão em "' || left(v_quadro, 60) || '"',
         left(new.title, 200)
    from (select v_dono as uid union select new.assignee_id) d
   where d.uid is not null
     and d.uid <> new.created_by;
  return new;
end;
$$;

drop trigger if exists trello_notificar_cartao_novo on public.trello_cards;
create trigger trello_notificar_cartao_novo
  after insert on public.trello_cards
  for each row execute function public.trello_notificar_cartao_novo();
