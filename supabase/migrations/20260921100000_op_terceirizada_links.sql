-- =====================================================================
-- GIFT WEB - Ordem de produção TERCEIRIZADA por link público temporário.
--
-- A produção gera, no item do PCP, um link para mandar à terceirizada:
-- mockup com a dimensão da logo (largura OU altura, em cm) e a arte do
-- cliente para baixar. Quem abre não tem login, então:
--   - a tabela NÃO é legível por anon;
--   - a página pública chama sistema_op_terceirizada_publica(token), que
--     devolve só o retrato congelado daquele link, e só enquanto não
--     expirou (7 dias por padrão).
-- O conteúdo é um snapshot no momento em que o link foi gerado: não
-- expõe o pedido, o cliente nem preço.
-- =====================================================================

create table if not exists public.sistema_op_terceirizada_links (
  id uuid primary key default gen_random_uuid(),
  producao_item_id uuid not null references public.sistema_producao_itens(id) on delete cascade,
  dimensao_tipo text not null check (dimensao_tipo in ('largura', 'altura')),
  dimensao_cm numeric not null check (dimensao_cm > 0),
  conteudo jsonb not null,
  criado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null default (now() + interval '7 days')
);

create index if not exists idx_op_terceirizada_item
  on public.sistema_op_terceirizada_links (producao_item_id, criado_em desc);

alter table public.sistema_op_terceirizada_links enable row level security;
grant select, insert on public.sistema_op_terceirizada_links to authenticated;

drop policy if exists "sistema le e cria links" on public.sistema_op_terceirizada_links;
create policy "sistema le e cria links" on public.sistema_op_terceirizada_links
  for all to authenticated
  using (public.is_admin_user()) with check (public.is_admin_user());

create or replace function public.sistema_op_terceirizada_publica(p_token uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'dimensao_tipo', l.dimensao_tipo,
    'dimensao_cm', l.dimensao_cm,
    'conteudo', l.conteudo,
    'criado_em', l.criado_em,
    'expira_em', l.expira_em
  )
  from public.sistema_op_terceirizada_links l
  where l.id = p_token and l.expira_em > now();
$$;

revoke all on function public.sistema_op_terceirizada_publica(uuid) from public;
grant execute on function public.sistema_op_terceirizada_publica(uuid) to anon, authenticated;
