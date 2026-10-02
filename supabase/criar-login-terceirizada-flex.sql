-- =====================================================================
-- Como criar o login da FLEX no painel /pcp/terceirizada
--
-- A migration 20261001100000_pcp_terceirizada_dashboard.sql já criou toda
-- a estrutura (tabela, funções, policies). A Flex já foi cadastrada pela
-- tela Sistema > Configurações > Terceirizadas. Faltam os passos abaixo.
--
-- PASSO 1 — Criar o usuário no Supabase Auth
--   No painel do Supabase: Authentication > Users > Add user
--     E-mail:  terceirizada@flex.com.br
--     Senha:   escolha uma senha forte (é essa senha que a FLEX vai
--              digitar no painel, junto com o e-mail acima em "Usuário")
--     Marque "Auto Confirm User" (senão o login fica pendente de e-mail
--     de confirmação, que esse endereço nunca vai receber).
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
values ('terceirizada@flex.com.br', '<AUTH_USER_ID>', '<TERCEIRIZADA_ID>');

-- =====================================================================
-- Conferência: deve voltar uma linha com o e-mail e o nome da terceirizada.
-- =====================================================================
select u.usuario, f.nome as terceirizada
  from public.sistema_terceirizada_usuarios u
  join public.sistema_fornecedores f on f.id = u.terceirizada_id
 where u.usuario = 'terceirizada@flex.com.br';

-- Pronto: a FLEX já pode entrar em giftwebbrindes.com.br/pcp/terceirizada
-- com usuário "terceirizada@flex.com.br" e a senha escolhida no Passo 1.
