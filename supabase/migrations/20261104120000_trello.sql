-- =====================================================================
-- GIFT WEB - Trello do /sistema (quadros, colunas, cartões, calendário
-- e lembretes).
--
-- Acesso: cada usuário só enxerga os quadros dos quais é dono ou membro.
-- As tabelas filhas herdam o acesso pelo board_id (ou pelo card_id ->
-- board_id). Lembretes e notificações são só do próprio usuário.
--
-- As checagens de acesso ficam em funções SECURITY DEFINER: uma policy em
-- trello_board_members que consultasse a própria trello_board_members
-- entraria em recursão infinita de RLS.
--
-- Posições (colunas e cartões) usam numeric com "fractional indexing":
-- mover = gravar o ponto médio entre os vizinhos, sem reescrever a lista.
--
-- Idempotente: pode rodar de novo no SQL Editor sem erro.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tabelas
-- ---------------------------------------------------------------------
create table if not exists public.trello_boards (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title       text not null,
  background  text,
  created_at  timestamptz not null default now()
);

create table if not exists public.trello_board_members (
  board_id    uuid not null references public.trello_boards(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'member' check (role in ('owner', 'member')),
  created_at  timestamptz not null default now(),
  primary key (board_id, user_id)
);

create table if not exists public.trello_columns (
  id          uuid primary key default gen_random_uuid(),
  board_id    uuid not null references public.trello_boards(id) on delete cascade,
  title       text not null,
  position    numeric not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.trello_cards (
  id           uuid primary key default gen_random_uuid(),
  board_id     uuid not null references public.trello_boards(id) on delete cascade,
  column_id    uuid not null references public.trello_columns(id) on delete cascade,
  title        text not null,
  description  text,
  cover_url    text,
  due_at       timestamptz,
  has_time     boolean not null default false,
  completed    boolean not null default false,
  archived     boolean not null default false,
  assignee_id  uuid references auth.users(id) on delete set null,
  position     numeric not null default 0,
  created_by   uuid default auth.uid() references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.trello_labels (
  id        uuid primary key default gen_random_uuid(),
  board_id  uuid not null references public.trello_boards(id) on delete cascade,
  name      text not null default '',
  color     text not null
);

create table if not exists public.trello_card_labels (
  card_id   uuid not null references public.trello_cards(id) on delete cascade,
  label_id  uuid not null references public.trello_labels(id) on delete cascade,
  primary key (card_id, label_id)
);

create table if not exists public.trello_checklist_items (
  id        uuid primary key default gen_random_uuid(),
  card_id   uuid not null references public.trello_cards(id) on delete cascade,
  text      text not null,
  done      boolean not null default false,
  position  numeric not null default 0
);

create table if not exists public.trello_attachments (
  id          uuid primary key default gen_random_uuid(),
  card_id     uuid not null references public.trello_cards(id) on delete cascade,
  file_url    text not null,   -- caminho no bucket "trello" (<board_id>/<card_id>/...)
  file_name   text not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.trello_comments (
  id          uuid primary key default gen_random_uuid(),
  card_id     uuid not null references public.trello_cards(id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  text        text not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.trello_reminders (
  id         uuid primary key default gen_random_uuid(),
  card_id    uuid not null references public.trello_cards(id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  remind_at  timestamptz not null,
  sent       boolean not null default false
);

create table if not exists public.trello_notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  card_id     uuid references public.trello_cards(id) on delete cascade,
  title       text not null,
  body        text,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. Índices
-- ---------------------------------------------------------------------
create index if not exists trello_cards_board_due_idx      on public.trello_cards (board_id, due_at);
create index if not exists trello_cards_column_pos_idx     on public.trello_cards (column_id, position);
create index if not exists trello_columns_board_pos_idx    on public.trello_columns (board_id, position);
create index if not exists trello_board_members_user_idx   on public.trello_board_members (user_id);
create index if not exists trello_labels_board_idx         on public.trello_labels (board_id);
create index if not exists trello_card_labels_label_idx    on public.trello_card_labels (label_id);
create index if not exists trello_checklist_card_idx       on public.trello_checklist_items (card_id, position);
create index if not exists trello_attachments_card_idx     on public.trello_attachments (card_id);
create index if not exists trello_comments_card_idx        on public.trello_comments (card_id, created_at);
create index if not exists trello_reminders_card_user_idx  on public.trello_reminders (card_id, user_id);
create index if not exists trello_reminders_pending_idx    on public.trello_reminders (remind_at) where sent = false;
create index if not exists trello_notifications_user_idx   on public.trello_notifications (user_id, created_at desc);

-- Permissões de tabela explícitas (o RLS abaixo é quem filtra as linhas).
grant select, insert, update, delete on
  public.trello_boards, public.trello_board_members, public.trello_columns,
  public.trello_cards, public.trello_labels, public.trello_card_labels,
  public.trello_checklist_items, public.trello_attachments, public.trello_comments,
  public.trello_reminders, public.trello_notifications
to authenticated;
revoke all on
  public.trello_boards, public.trello_board_members, public.trello_columns,
  public.trello_cards, public.trello_labels, public.trello_card_labels,
  public.trello_checklist_items, public.trello_attachments, public.trello_comments,
  public.trello_reminders, public.trello_notifications
from anon;

-- ---------------------------------------------------------------------
-- 3. Funções de acesso (SECURITY DEFINER evita recursão de RLS)
-- ---------------------------------------------------------------------
create or replace function public.trello_tem_acesso(p_board uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.trello_boards b
     where b.id = p_board and b.owner_id = auth.uid()
  ) or exists (
    select 1 from public.trello_board_members m
     where m.board_id = p_board and m.user_id = auth.uid()
  );
$$;

create or replace function public.trello_card_acesso(p_card uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.trello_cards c
     where c.id = p_card and public.trello_tem_acesso(c.board_id)
  );
$$;

create or replace function public.trello_dono(p_board uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.trello_boards b
     where b.id = p_board and b.owner_id = auth.uid()
  );
$$;

revoke all on function public.trello_tem_acesso(uuid)  from public, anon;
revoke all on function public.trello_card_acesso(uuid) from public, anon;
revoke all on function public.trello_dono(uuid)        from public, anon;
grant execute on function public.trello_tem_acesso(uuid)  to authenticated;
grant execute on function public.trello_card_acesso(uuid) to authenticated;
grant execute on function public.trello_dono(uuid)        to authenticated;

-- Usuários do sistema (para "responsável"). sistema_listar_usuarios() é só
-- do admin; esta devolve só id/nome/e-mail e exige ser da equipe interna.
create or replace function public.trello_listar_usuarios()
returns table (user_id uuid, nome text, email text)
language sql stable security definer set search_path = public
as $$
  select a.id, a.nome, a.email
    from public.admin_users a
   where public.is_admin_user()
   order by a.nome nulls last, a.email;
$$;
revoke all on function public.trello_listar_usuarios() from public, anon;
grant execute on function public.trello_listar_usuarios() to authenticated;

-- ---------------------------------------------------------------------
-- 4. Gatilhos
-- ---------------------------------------------------------------------
-- Dono entra automaticamente como membro (base para compartilhar depois).
create or replace function public.trello_board_add_owner()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.trello_board_members (board_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (board_id, user_id) do update set role = 'owner';
  return new;
end;
$$;

drop trigger if exists trello_board_add_owner on public.trello_boards;
create trigger trello_board_add_owner
  after insert on public.trello_boards
  for each row execute function public.trello_board_add_owner();

create or replace function public.trello_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trello_cards_updated_at on public.trello_cards;
create trigger trello_cards_updated_at
  before update on public.trello_cards
  for each row execute function public.trello_touch_updated_at();

-- ---------------------------------------------------------------------
-- 5. RLS
-- ---------------------------------------------------------------------
alter table public.trello_boards          enable row level security;
alter table public.trello_board_members   enable row level security;
alter table public.trello_columns         enable row level security;
alter table public.trello_cards           enable row level security;
alter table public.trello_labels          enable row level security;
alter table public.trello_card_labels     enable row level security;
alter table public.trello_checklist_items enable row level security;
alter table public.trello_attachments     enable row level security;
alter table public.trello_comments        enable row level security;
alter table public.trello_reminders       enable row level security;
alter table public.trello_notifications   enable row level security;

-- Quadros: cria só a equipe interna (mesma regra do /sistema), sempre como dono.
drop policy if exists "trello boards select" on public.trello_boards;
create policy "trello boards select" on public.trello_boards
  for select to authenticated using (public.trello_tem_acesso(id));
drop policy if exists "trello boards insert" on public.trello_boards;
create policy "trello boards insert" on public.trello_boards
  for insert to authenticated with check (owner_id = auth.uid() and public.is_admin_user());
drop policy if exists "trello boards update" on public.trello_boards;
create policy "trello boards update" on public.trello_boards
  for update to authenticated using (public.trello_tem_acesso(id)) with check (public.trello_tem_acesso(id));
drop policy if exists "trello boards delete" on public.trello_boards;
create policy "trello boards delete" on public.trello_boards
  for delete to authenticated using (owner_id = auth.uid());

-- Membros: todos do quadro veem; só o dono convida/remove.
drop policy if exists "trello members select" on public.trello_board_members;
create policy "trello members select" on public.trello_board_members
  for select to authenticated using (public.trello_tem_acesso(board_id));
drop policy if exists "trello members insert" on public.trello_board_members;
create policy "trello members insert" on public.trello_board_members
  for insert to authenticated with check (public.trello_dono(board_id));
drop policy if exists "trello members update" on public.trello_board_members;
create policy "trello members update" on public.trello_board_members
  for update to authenticated using (public.trello_dono(board_id)) with check (public.trello_dono(board_id));
drop policy if exists "trello members delete" on public.trello_board_members;
create policy "trello members delete" on public.trello_board_members
  for delete to authenticated using (public.trello_dono(board_id) or user_id = auth.uid());

-- Tabelas com board_id: acesso pelo quadro.
do $$
declare t text;
begin
  foreach t in array array['trello_columns', 'trello_cards', 'trello_labels'] loop
    execute format('drop policy if exists "%s acesso pelo quadro" on public.%I', t, t);
    execute format(
      'create policy "%s acesso pelo quadro" on public.%I for all to authenticated
         using (public.trello_tem_acesso(board_id)) with check (public.trello_tem_acesso(board_id))',
      t, t);
  end loop;
end $$;

-- Tabelas com card_id: acesso pelo quadro do cartão.
do $$
declare t text;
begin
  foreach t in array array['trello_card_labels', 'trello_checklist_items', 'trello_attachments'] loop
    execute format('drop policy if exists "%s acesso pelo cartao" on public.%I', t, t);
    execute format(
      'create policy "%s acesso pelo cartao" on public.%I for all to authenticated
         using (public.trello_card_acesso(card_id)) with check (public.trello_card_acesso(card_id))',
      t, t);
  end loop;
end $$;

-- Comentários: lê quem acessa o cartão; escreve/edita/apaga só o autor.
drop policy if exists "trello comments select" on public.trello_comments;
create policy "trello comments select" on public.trello_comments
  for select to authenticated using (public.trello_card_acesso(card_id));
drop policy if exists "trello comments insert" on public.trello_comments;
create policy "trello comments insert" on public.trello_comments
  for insert to authenticated with check (user_id = auth.uid() and public.trello_card_acesso(card_id));
drop policy if exists "trello comments update" on public.trello_comments;
create policy "trello comments update" on public.trello_comments
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "trello comments delete" on public.trello_comments;
create policy "trello comments delete" on public.trello_comments
  for delete to authenticated using (user_id = auth.uid());

-- Lembretes: só os do próprio usuário (e de cartão que ele acessa).
drop policy if exists "trello reminders proprios" on public.trello_reminders;
create policy "trello reminders proprios" on public.trello_reminders
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.trello_card_acesso(card_id));

-- Notificações: só as do próprio usuário. Quem cria é o job do pg_cron
-- (roda como postgres, fora do RLS) — o usuário só lê, marca lida e apaga.
drop policy if exists "trello notifications select" on public.trello_notifications;
create policy "trello notifications select" on public.trello_notifications
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "trello notifications update" on public.trello_notifications;
create policy "trello notifications update" on public.trello_notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "trello notifications delete" on public.trello_notifications;
create policy "trello notifications delete" on public.trello_notifications
  for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 6. Storage: bucket privado "trello" (capas e anexos)
--    Caminho: <board_id>/<card_id>/<arquivo> -> o acesso segue o quadro.
--    O front usa URLs assinadas (bucket não é público).
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('trello', 'trello', false)
on conflict (id) do update set public = false;

create or replace function public.trello_storage_acesso(p_name text)
returns boolean
language plpgsql stable security definer set search_path = public
as $$
declare v_board uuid;
begin
  begin
    v_board := split_part(p_name, '/', 1)::uuid;
  exception when others then
    return false;
  end;
  return public.trello_tem_acesso(v_board);
end;
$$;
revoke all on function public.trello_storage_acesso(text) from public, anon;
grant execute on function public.trello_storage_acesso(text) to authenticated;

drop policy if exists "trello storage select" on storage.objects;
create policy "trello storage select" on storage.objects
  for select to authenticated
  using (bucket_id = 'trello' and public.trello_storage_acesso(name));
drop policy if exists "trello storage insert" on storage.objects;
create policy "trello storage insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'trello' and public.trello_storage_acesso(name));
drop policy if exists "trello storage update" on storage.objects;
create policy "trello storage update" on storage.objects
  for update to authenticated
  using (bucket_id = 'trello' and public.trello_storage_acesso(name))
  with check (bucket_id = 'trello' and public.trello_storage_acesso(name));
drop policy if exists "trello storage delete" on storage.objects;
create policy "trello storage delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'trello' and public.trello_storage_acesso(name));

-- ---------------------------------------------------------------------
-- 7. Realtime
-- ---------------------------------------------------------------------
alter table public.trello_cards         replica identity full;
alter table public.trello_columns       replica identity full;
alter table public.trello_notifications replica identity full;

do $$
declare t text;
begin
  foreach t in array array['trello_cards', 'trello_columns', 'trello_notifications'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception
      when duplicate_object then null;  -- já publicada
      when undefined_object then null;  -- publicação não existe neste ambiente
    end;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 8. Lembretes: pg_cron a cada minuto, tudo em SQL (sem Edge Function).
--    pg_cron já está ativo neste projeto (job sync-produtos-xbz-05h).
-- ---------------------------------------------------------------------
create or replace function public.trello_processar_lembretes()
returns integer
language plpgsql security definer set search_path = public
as $$
declare v_qtd integer;
begin
  with vencidos as (
    update public.trello_reminders r
       set sent = true
     where r.sent = false
       and r.remind_at <= now()
    returning r.user_id, r.card_id
  ), novas as (
    insert into public.trello_notifications (user_id, card_id, title, body)
    select v.user_id,
           v.card_id,
           c.title,
           case
             when c.due_at is null then 'Lembrete do cartão'
             else 'Entrega: ' ||
                  to_char(c.due_at at time zone 'America/Sao_Paulo',
                          case when c.has_time then 'DD/MM/YYYY "às" HH24:MI' else 'DD/MM/YYYY' end)
           end
      from vencidos v
      join public.trello_cards c on c.id = v.card_id
     where c.archived = false
    returning 1
  )
  select count(*) into v_qtd from novas;
  return v_qtd;
end;
$$;
revoke all on function public.trello_processar_lembretes() from public, anon, authenticated;

create extension if not exists pg_cron;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'trello-lembretes') then
    perform cron.unschedule('trello-lembretes');
  end if;
  perform cron.schedule('trello-lembretes', '* * * * *', 'select public.trello_processar_lembretes();');
end $$;
