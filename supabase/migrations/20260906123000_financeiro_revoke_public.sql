-- =====================================================================
-- Fecha a RPC do dashboard para o público.
--
-- No PostgreSQL toda função nasce com EXECUTE concedido a PUBLIC, então o
-- GRANT ... TO authenticated da migration anterior não restringiu nada: o
-- papel anon conseguia executar sistema_dashboard_financeiro.
--
-- Não houve exposição de dados — a função é SECURITY INVOKER e o RLS das
-- tabelas devolvia conjunto vazio para anon, resultando em zeros. Ainda
-- assim, a defesa não deve depender só do RLS: sem o REVOKE, um descuido
-- futuro numa policy passaria a vazar faturamento por uma chamada pública.
-- =====================================================================

REVOKE ALL ON FUNCTION public.sistema_dashboard_financeiro(date, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sistema_dashboard_financeiro(date, date) FROM anon;
GRANT EXECUTE ON FUNCTION public.sistema_dashboard_financeiro(date, date) TO authenticated;

-- Mesmo cuidado nas views do financeiro: elas expõem custo e margem.
REVOKE ALL ON public.sistema_venda_item_resultado FROM PUBLIC, anon;
REVOKE ALL ON public.sistema_venda_resultado      FROM PUBLIC, anon;
GRANT SELECT ON public.sistema_venda_item_resultado TO authenticated;
GRANT SELECT ON public.sistema_venda_resultado      TO authenticated;
