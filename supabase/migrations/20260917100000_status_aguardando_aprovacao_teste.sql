-- =====================================================================
-- GIFT WEB - Adiciona o status "Aguardando Aprovação Teste" ao catálogo.
--
-- Faltou no seed original (20260916120000_status_catalogo.sql): a lista dos
-- 13 status do Calcme tinha 2 etapas de teste distintas —
-- "Aguardando Teste (Laser/DTF)" (o teste está sendo feito) e "Aguardando
-- Aprovação Teste" (o teste foi feito, aguarda o cliente aprovar) — e só a
-- primeira entrou no seed. Confirmado ao reimportar os pedidos reais: 10 dos
-- 88 itens usam esse status.
-- =====================================================================

insert into public.sistema_status (slug, nome, cor, ordem, coluna_pcp, escopo, protegido)
values ('aguardando_aprovacao_teste', 'Aguardando aprovação teste', '#C026D3', 45, 'teste_fisico', 'ambos', false)
on conflict (slug) do nothing;
