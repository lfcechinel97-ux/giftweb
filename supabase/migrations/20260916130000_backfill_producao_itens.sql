-- =====================================================================
-- GIFT WEB - Conserta a criacao automatica de linhas de producao e faz o
-- backfill do que ficou para tras.
--
-- Diagnostico (16/09/2026, dados de producao):
--   sistema_pedidos ............. 37
--   sistema_calcme_itens ........ 82
--   sistema_producao_itens ....... 4   <-- de 2 pedidos manuais de agosto
--
-- Nenhum pedido importado do Calcme tinha linha de producao. Consequencia:
-- o PCP nao mostrava nada do que foi importado e o status por item nao
-- tinha onde existir.
--
-- Causa: a migration 08 (que cria trg_producao_inicial, o gatilho de
-- INSERT) mora em migrations_historico e aparentemente nao chegou a ser
-- aplicada por inteiro. So o gatilho de UPDATE, criado em
-- 20260809110154, existe — e ele nao dispara na PRIMEIRA importacao,
-- que e um INSERT.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Funcao (identica a da 08, recriada aqui para nao depender de um
--    arquivo que talvez nunca tenha rodado)
-- ---------------------------------------------------------------------
create or replace function public.sistema_criar_producao_inicial()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare item jsonb;
begin
  for item in select * from jsonb_array_elements(coalesce(new.itens, '[]'::jsonb))
  loop
    -- Item sem id, ou com id que nao e uuid, e ignorado em vez de abortar
    -- a gravacao do pedido inteiro.
    if item->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      insert into public.sistema_producao_itens (pedido_id, item_id)
      values (new.id, (item->>'id')::uuid)
      on conflict (pedido_id, item_id) do nothing;
    end if;
  end loop;
  return new;
end; $fn$;

-- ---------------------------------------------------------------------
-- 2) Os DOIS gatilhos. O de INSERT cobre a primeira importacao e o
--    aprovarOrcamento; o de UPDATE cobre a re-sincronizacao do Calcme e
--    a edicao de itens na tela.
-- ---------------------------------------------------------------------
drop trigger if exists trg_producao_inicial on public.sistema_pedidos;
create trigger trg_producao_inicial
  after insert on public.sistema_pedidos
  for each row execute function public.sistema_criar_producao_inicial();

drop trigger if exists trg_producao_inicial_update on public.sistema_pedidos;
create trigger trg_producao_inicial_update
  after update of itens on public.sistema_pedidos
  for each row execute function public.sistema_criar_producao_inicial();

-- ---------------------------------------------------------------------
-- 3) Backfill — cria a linha que falta para cada item ja existente.
--    on conflict do nothing preserva o status dos 4 itens que ja tinham
--    linha; nada e sobrescrito.
-- ---------------------------------------------------------------------
insert into public.sistema_producao_itens (pedido_id, item_id)
select p.id, (e.value->>'id')::uuid
from public.sistema_pedidos p
cross join lateral jsonb_array_elements(coalesce(p.itens, '[]'::jsonb)) e
where e.value->>'id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
on conflict (pedido_id, item_id) do nothing;

-- =====================================================================
-- CONFERENCIA
-- =====================================================================
-- select
--   (select count(*) from sistema_pedidos)                                     as pedidos,
--   (select count(*) from sistema_pedidos p,
--      lateral jsonb_array_elements(coalesce(p.itens,'[]'::jsonb)))            as itens_no_jsonb,
--   (select count(*) from sistema_producao_itens)                              as linhas_producao;
-- -- itens_no_jsonb e linhas_producao devem bater.
