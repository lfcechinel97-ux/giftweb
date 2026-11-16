-- Prazo de entrega do orçamento em faixa ("10 a 15 dias úteis"):
-- prazo_entrega = de, prazo_entrega_ate = até (null = prazo único).
alter table public.sistema_orcamentos
  add column if not exists prazo_entrega_ate integer;