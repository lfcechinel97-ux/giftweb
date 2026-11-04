-- =====================================================================
-- GIFT WEB - Trello: corrige "new row violates row-level security policy
-- for table trello_boards" ao criar quadro.
--
-- O app cria o quadro com INSERT ... RETURNING (.select() no supabase-js).
-- No RETURNING o Postgres também aplica a policy de SELECT na linha nova,
-- e trello_tem_acesso(id) procura o quadro numa consulta separada, que
-- ainda não enxerga a linha sendo inserida -> falso -> erro.
-- Checar owner_id direto na linha resolve (o dono sempre vê o quadro).
-- Idempotente.
-- =====================================================================
drop policy if exists "trello boards select" on public.trello_boards;
create policy "trello boards select" on public.trello_boards
  for select to authenticated
  using (owner_id = auth.uid() or public.trello_tem_acesso(id));
