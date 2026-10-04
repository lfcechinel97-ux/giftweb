-- =====================================================================
-- GIFT WEB - Histórico de gerações do Mockup Studio: cada chamada de IA
-- grava o modelo usado, os tokens gastos e a imagem gerada (sem a marca
-- d'água, que é aplicada no navegador). Quem grava é a edge function
-- gerar-mockup-final via service role; o vendedor só lê as próprias.
-- Bucket PRIVADO (logo de cliente) -- o client lê por signed URL.
-- =====================================================================

create table if not exists public.mockup_geracoes (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  produto_nome text,
  produto_codigo text,
  tecnica text not null,
  modelo text not null,
  tokens_entrada integer,
  tokens_saida integer,
  tokens_total integer,
  uso jsonb,
  imagem_path text not null
);

create index if not exists mockup_geracoes_user_criado_idx
  on public.mockup_geracoes (user_id, criado_em desc);

alter table public.mockup_geracoes enable row level security;

drop policy if exists "le as proprias geracoes de mockup" on public.mockup_geracoes;
create policy "le as proprias geracoes de mockup" on public.mockup_geracoes
  for select to authenticated
  using (user_id = auth.uid());

revoke all on public.mockup_geracoes from anon;
grant select on public.mockup_geracoes to authenticated;

insert into storage.buckets (id, name, public)
values ('mockup-geracoes', 'mockup-geracoes', false)
on conflict (id) do nothing;

-- Arquivos ficam em <user_id>/<id>.png -- cada um lê só a própria pasta.
drop policy if exists "le as proprias imagens de mockup" on storage.objects;
create policy "le as proprias imagens de mockup" on storage.objects
  for select to authenticated
  using (bucket_id = 'mockup-geracoes' and (storage.foldername(name))[1] = auth.uid()::text);
