-- =====================================================================
-- Como criar o login da FLEX no painel /pcp/terceirizada
--
-- A migration 20261001100000_pcp_terceirizada_dashboard.sql já criou toda
-- a estrutura (tabela, funções, policies). Falta só o passo abaixo, que
-- PRECISA ser feito manualmente porque criar um usuário no Supabase Auth
-- não dá pra fazer com um INSERT comum de migration.
--
-- PASSO 1 — Criar o usuário no Supabase Auth
--   No painel do Supabase: Authentication > Users > Add user
--     E-mail:  flex@terceirizadas.giftweb.internal
--     Senha:   escolha uma senha forte (é essa senha que a FLEX vai digitar
--              no painel, junto com o usuário "flex")
--     Marque "Auto Confirm User" (senão o login fica pendente de e-mail
--     de confirmação, que esse endereço fictício nunca vai receber).
--
-- PASSO 2 — Achar o id da FLEX em sistema_fornecedores
-- =====================================================================
select id, nome, tipo from public.sistema_fornecedores where nome ilike '%flex%';

-- =====================================================================
-- PASSO 3 — Vincular o usuário recém-criado à FLEX
--   Troque:
--     <AUTH_USER_ID>     pelo id do usuário criado no Passo 1 (copie na
--                        tela do usuário em Authentication > Users)
--     <TERCEIRIZADA_ID>  pelo id que voltou no Passo 2
-- =====================================================================
insert into public.sistema_terceirizada_usuarios (usuario, auth_user_id, terceirizada_id)
values ('flex', '<AUTH_USER_ID>', '<TERCEIRIZADA_ID>');

-- =====================================================================
-- Conferência: deve voltar uma linha com "flex" e o nome da terceirizada.
-- =====================================================================
select u.usuario, f.nome as terceirizada
  from public.sistema_terceirizada_usuarios u
  join public.sistema_fornecedores f on f.id = u.terceirizada_id
 where u.usuario = 'flex';

-- Pronto: a FLEX já pode entrar em giftwebbrindes.com.br/pcp/terceirizada
-- com usuário "flex" e a senha escolhida no Passo 1.
