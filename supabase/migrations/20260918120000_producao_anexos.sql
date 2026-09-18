-- =====================================================================
-- GIFT WEB - Anexos genéricos do item de produção.
--
-- Hoje só existem 2 campos de arquivo único em sistema_producao_itens
-- (teste_anexo_url, producao_anexo_url) -- cada um alimenta uma
-- automação de tag específica e continua exatamente como está, sem
-- mudança de contrato. Esta tabela é ADITIVA: cobre o resto que o
-- usuário pediu centralizado no item (logo, mockup, etiqueta, nota
-- fiscal, e múltiplos arquivos por categoria em vez de só o último).
-- Mesmo bucket de storage já em uso (`mockups`), nenhuma infra nova.
-- =====================================================================

create table if not exists public.sistema_producao_anexos (
  id uuid primary key default gen_random_uuid(),
  producao_item_id uuid not null references public.sistema_producao_itens(id) on delete cascade,
  pedido_id uuid not null references public.sistema_pedidos(id) on delete cascade,
  categoria text not null check (categoria in ('logo', 'mockup', 'teste', 'producao', 'etiqueta', 'nota_fiscal', 'outro')),
  tipo text not null check (tipo in ('foto', 'video', 'pdf', 'outro')),
  url text not null,
  nome_arquivo text,
  vendedor_id uuid references public.sistema_vendedores(id),
  created_at timestamptz not null default now()
);

create index if not exists idx_producao_anexos_item
  on public.sistema_producao_anexos (producao_item_id, created_at desc);

alter table public.sistema_producao_anexos enable row level security;

create policy "sistema_producao_anexos_admin" on public.sistema_producao_anexos
  for all to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

grant select, insert, update, delete on public.sistema_producao_anexos to authenticated;

-- Backfill: os 2 anexos que já existem (teste/produção) entram na tabela
-- nova também, pra a seção "Anexos" já nascer mostrando o que tem.
insert into public.sistema_producao_anexos (producao_item_id, pedido_id, categoria, tipo, url, created_at)
select pi.id, pi.pedido_id, 'teste', 'foto', pi.teste_anexo_url, coalesce(pi.teste_enviado_em, now())
from public.sistema_producao_itens pi
where pi.teste_anexo_url is not null;

insert into public.sistema_producao_anexos (producao_item_id, pedido_id, categoria, tipo, url, created_at)
select pi.id, pi.pedido_id, 'producao', coalesce(pi.producao_anexo_tipo, 'foto'), pi.producao_anexo_url, coalesce(pi.producao_anexo_em, now())
from public.sistema_producao_itens pi
where pi.producao_anexo_url is not null;
