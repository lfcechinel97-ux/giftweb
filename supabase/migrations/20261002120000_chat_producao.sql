-- =====================================================================
-- GIFT WEB - Chat por produto (reaproveita sistema_producao_comentarios,
-- já usada pelas "Observações" do PCP). Ganha:
--   - mencionados uuid[]: quem foi @mencionado nessa mensagem
--   - lido_por uuid[]: quem já viu essa mensagem (marca notificação)
--   - RLS reescrita: agora que terceirizadas têm login de verdade, a
--     policy antiga "USING (true)" deixava QUALQUER autenticado ler/
--     escrever comentário de QUALQUER produto do sistema inteiro, não só
--     o seu. Aperta pro mesmo criterio ja usado em sistema_producao_itens
--     (admin ve tudo; terceirizada só os itens com o terceirizada_id dela).
--   - sistema_chat_resumo(): não-lidas e @menções por item, pro card do
--     quadro mostrar notificação sem abrir cada produto.
-- =====================================================================

alter table public.sistema_producao_comentarios
  add column if not exists mencionados uuid[] not null default '{}',
  add column if not exists lido_por uuid[] not null default '{}';

drop policy if exists "Autenticados leem comentarios de producao" on public.sistema_producao_comentarios;
drop policy if exists "Autenticados criam comentarios de producao" on public.sistema_producao_comentarios;

create policy "leem comentarios dos proprios itens" on public.sistema_producao_comentarios
  for select to authenticated
  using (
    public.is_admin_user()
    or exists (
      select 1 from public.sistema_producao_itens pi
       where pi.id = producao_item_id
         and public.terceirizada_id_atual() is not null
         and pi.terceirizada_id = public.terceirizada_id_atual()
    )
  );

create policy "criam comentarios nos proprios itens" on public.sistema_producao_comentarios
  for insert to authenticated
  with check (
    (auth.uid() = autor_id or autor_id is null)
    and (
      public.is_admin_user()
      or exists (
        select 1 from public.sistema_producao_itens pi
         where pi.id = producao_item_id
           and public.terceirizada_id_atual() is not null
           and pi.terceirizada_id = public.terceirizada_id_atual()
      )
    )
  );

-- Nova: marcar como lida (só mexe em mencionados/lido_por na prática, mas
-- RLS não restringe coluna -- mesmo nível de confiança já usado no resto
-- do app). Sem isso, abrir o chat nunca limpava a notificação.
drop policy if exists "marcam mensagens como lidas" on public.sistema_producao_comentarios;
create policy "marcam mensagens como lidas" on public.sistema_producao_comentarios
  for update to authenticated
  using (
    public.is_admin_user()
    or exists (
      select 1 from public.sistema_producao_itens pi
       where pi.id = producao_item_id
         and public.terceirizada_id_atual() is not null
         and pi.terceirizada_id = public.terceirizada_id_atual()
    )
  )
  with check (true);

create index if not exists idx_producao_comentarios_nao_lidas
  on public.sistema_producao_comentarios using gin (lido_por);

-- Resumo pro badge de notificação no card do quadro: só os itens que TÊM
-- mensagem não lida por quem está chamando, com a contagem e se foi
-- @mencionado em alguma delas.
create or replace function public.sistema_chat_resumo()
returns table (producao_item_id uuid, nao_lidas int, mencionado boolean)
language sql stable security definer set search_path = public as $$
  select c.producao_item_id,
    count(*)::int as nao_lidas,
    bool_or(coalesce(auth.uid() = any(c.mencionados), false)) as mencionado
  from public.sistema_producao_comentarios c
  join public.sistema_producao_itens pi on pi.id = c.producao_item_id
  where not coalesce(auth.uid() = any(c.lido_por), false)
    and (
      public.is_admin_user()
      or (public.terceirizada_id_atual() is not null and pi.terceirizada_id = public.terceirizada_id_atual())
    )
  group by c.producao_item_id
$$;

revoke all on function public.sistema_chat_resumo() from public, anon;
grant execute on function public.sistema_chat_resumo() to authenticated;

alter table public.sistema_producao_comentarios replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and tablename = 'sistema_producao_comentarios'
  ) then
    execute 'alter publication supabase_realtime add table public.sistema_producao_comentarios';
  end if;
end $$;
