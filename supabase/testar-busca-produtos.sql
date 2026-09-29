-- Depois de rodar a migration 20260929110000, teste com um termo real:
select jsonb_pretty(to_jsonb(public.sistema_search_products('copo termico', 1, 10)));

-- Tempo da consulta (deve ser rápido, sem "Seq Scan" na tabela grande):
explain analyze select public.sistema_search_products('copo termico', 1, 30);
