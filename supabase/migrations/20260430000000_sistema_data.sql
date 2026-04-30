-- Tabela para persistir dados do sistema de vendas (orçamentos, pedidos, clientes, etc.)
-- Usa uma única linha por chave (singleton pattern) para simplicidade máxima.

create table if not exists public.sistema_data (
  key text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Permite leitura e escrita sem autenticação (dados internos do sistema de vendas)
alter table public.sistema_data enable row level security;

create policy "allow_all_sistema_data"
  on public.sistema_data
  for all
  using (true)
  with check (true);

-- Índice para performance
create index if not exists sistema_data_key_idx on public.sistema_data (key);
