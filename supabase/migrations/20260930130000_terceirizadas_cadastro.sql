-- =====================================================================
-- GIFT WEB - Cadastro de terceirizadas em Configurações. A tabela
-- sistema_fornecedores já existe e já é lida no PCP (popup "Qual
-- terceirizada?"); esta migration só garante que todo mundo consegue
-- ler (select) e só admin cria/edita/remove (mesmo padrão das outras
-- tabelas de configuração, ex.: sistema_status).
--
-- Seed: as 3 terceirizadas que a Gift Web já costuma usar (Flex Camila,
-- SLC Impressões, 3N Print Alê) -- só entra se ainda não existir uma com
-- esse nome.
-- =====================================================================

alter table public.sistema_fornecedores enable row level security;

drop policy if exists "auth le fornecedores" on public.sistema_fornecedores;
create policy "auth le fornecedores" on public.sistema_fornecedores
  for select to authenticated using (true);

drop policy if exists "admin escreve fornecedores" on public.sistema_fornecedores;
create policy "admin escreve fornecedores" on public.sistema_fornecedores
  for all to authenticated
  using (public.is_admin_user())
  with check (public.is_admin_user());

revoke all on public.sistema_fornecedores from anon;
grant select, insert, update, delete on public.sistema_fornecedores to authenticated;

insert into public.sistema_fornecedores (nome, tipo)
select v.nome, 'terceirizada'
from (values ('Flex Camila'), ('SLC Impressões'), ('3N Print Alê')) as v(nome)
where not exists (
  select 1 from public.sistema_fornecedores f where lower(f.nome) = lower(v.nome)
);
