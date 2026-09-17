-- =====================================================================
-- GIFT WEB - Lista mestre de etiquetas do PCP.
--
-- Hoje "tags" em sistema_producao_itens é texto livre (text[]) -- cada
-- pessoa digita do seu jeito ("Comprado XBZ", "comprado xbz", "COMPRADO
-- XBZ ") e a mesma etiqueta vira várias diferentes espalhadas pelos
-- pedidos. Esta migration NÃO troca a coluna `tags` (continua text[],
-- nada que já lê/escreve nela quebra) -- só cria o catálogo que o
-- combobox do PCP passa a consultar antes de criar uma etiqueta nova,
-- e que os filtros do board passam a usar (uniforme com o que existe
-- no pedido, em vez de só o que os cards carregados na tela têm).
-- =====================================================================

create table if not exists public.sistema_etiquetas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  -- índice de unicidade sem diferenciar maiúsc/minúsc: é isso que evita
  -- a duplicidade ("XBZ" vs "xbz") que o usuário reportou.
  nome_norm text generated always as (lower(nome)) stored,
  cor text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists sistema_etiquetas_nome_norm_key
  on public.sistema_etiquetas (nome_norm);

alter table public.sistema_etiquetas enable row level security;

-- Mesmo padrão de permissão das outras tabelas de catálogo do sistema
-- (sistema_vendedores, sistema_clientes, etc.) -- único login da
-- equipe, então "authenticated" é só a barreira de fora, não entre
-- membros do time.
create policy "sistema_etiquetas_admin" on public.sistema_etiquetas
  for all to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

grant select, insert, update on public.sistema_etiquetas to authenticated;

-- Backfill: toda etiqueta que já existe em qualquer item de produção
-- entra pro catálogo de uma vez, pra o combobox já nascer útil.
insert into public.sistema_etiquetas (nome)
select distinct trim(t)
from public.sistema_producao_itens, unnest(tags) as t
where trim(t) <> ''
on conflict (nome_norm) do nothing;
