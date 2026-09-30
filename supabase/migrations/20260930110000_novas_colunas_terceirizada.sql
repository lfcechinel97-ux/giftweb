-- =====================================================================
-- GIFT WEB - 2 novas colunas do PCP: "Aguardando Teste Terceirizada" e
-- "A Produzir Terceirizada", desmembrando "Aguardando Teste" (Galpão) e
-- "A Produzir" (Galpão) das etapas equivalentes por terceirizada.
--
-- Diagnóstico feito antes desta migration (30/09/2026):
--   - teste_fisico: 28 itens, TODOS galpão hoje (0 terceirizada) --
--     nenhum item precisa mudar de status para essa coluna.
--   - em_producao: 26 itens, TODOS com status = 'a_produzir' (o slug
--     'a_produzir_terceirizada' existe no catálogo desde 16/09 mas
--     nenhum item o usa) -- 12 são Galpão (local_producao/tag batem com
--     o slug atual), 14 são Terceirizada (local_producao='terceirizada'
--     ou tag "TERCEIRIZADA..." mas o status ainda é 'a_produzir').
--   - Nenhum item "indefinido" (sem local_producao nem tag reconhecível).
-- Por isso: só precisa RECLASSIFICAR esses 14 itens; os outros 12 e os
-- 28 de teste ficam como estão (só a coluna_pcp do slug muda de lugar).
--
-- Idempotente: todo UPDATE é condicional; pode rodar mais de uma vez.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) CHECK constraint de coluna_pcp: adiciona 'teste_fisico_terceirizada'.
--    'em_producao_terceirizada' já está liberado desde 18/09.
-- ---------------------------------------------------------------------
alter table public.sistema_status drop constraint if exists sistema_status_coluna_pcp_check;
alter table public.sistema_status add constraint sistema_status_coluna_pcp_check
  check (coluna_pcp in (
    'organizando_pedido', 'organizando_comercial', 'pronto_producao', 'aguardando_mercadoria',
    'teste_fisico', 'teste_fisico_terceirizada', 'teste_enviado', 'preparacao',
    'em_producao', 'em_producao_terceirizada', 'produzido', 'inserir_medidas',
    'embalagem_pagamento', 'aguardando_coleta', 'enviado', 'cancelado'));

-- ---------------------------------------------------------------------
-- 2) Novo status: "Aguardando Teste Terceirizada" (coluna própria)
-- ---------------------------------------------------------------------
insert into public.sistema_status (slug, nome, cor, ordem, coluna_pcp, escopo, protegido)
values ('aguardando_teste_terceirizada', 'Aguardando teste terceirizada', '#EA580C', 42, 'teste_fisico_terceirizada', 'ambos', false)
on conflict (slug) do update set coluna_pcp = excluded.coluna_pcp;

-- ---------------------------------------------------------------------
-- 3) Reaproveita o slug "a_produzir_terceirizada" (já existe desde
--    16/09) -- só muda para onde ele aponta.
-- ---------------------------------------------------------------------
update public.sistema_status
   set coluna_pcp = 'em_producao_terceirizada'
 where slug = 'a_produzir_terceirizada';

-- ---------------------------------------------------------------------
-- 4) Reclassifica os itens de "A Produzir" que já são terceirizada de
--    verdade (local_producao ou tag), mas ainda estão com o slug antigo.
--    Não mexe em nenhum item que já é 'a_produzir_terceirizada'.
-- ---------------------------------------------------------------------
update public.sistema_producao_itens pi
   set status = 'a_produzir_terceirizada'
 where pi.status = 'a_produzir'
   and (
     pi.local_producao = 'terceirizada'
     or exists (select 1 from unnest(pi.tags) t where upper(t) like 'TERCEIRIZADA%')
   );

-- ---------------------------------------------------------------------
-- 5) Preenche terceirizada_nome_livre a partir da tag "TERCEIRIZADA - X"
--    (ou "TERCEIRIZADA + X", grafia antiga) nos itens que já são
--    terceirizada mas ainda não têm fornecedor nem nome livre gravado --
--    é o que faz o card/modal já aparecer com o nome de quem já estava
--    fazendo, sem a produção ter que digitar de novo.
-- ---------------------------------------------------------------------
update public.sistema_producao_itens pi
   set terceirizada_nome_livre = t.nome
  from (
    select pi2.id,
           trim(regexp_replace(tag.valor, '^TERCEIRIZADA\s*[+-]\s*', '', 'i')) as nome
      from public.sistema_producao_itens pi2
      cross join lateral unnest(pi2.tags) as tag(valor)
     where tag.valor ilike 'terceirizada%'
  ) t
 where pi.id = t.id
   and pi.terceirizada_id is null
   and (pi.terceirizada_nome_livre is null or pi.terceirizada_nome_livre = '')
   and t.nome <> '';

-- =====================================================================
-- CONFERÊNCIA (rode depois de aplicar)
-- =====================================================================
-- select s.coluna_pcp, count(*) from public.sistema_producao_itens pi
--   join public.sistema_status s on s.slug = pi.status group by 1 order by 2 desc;
-- -- esperado: em_producao (galpão) = 12, em_producao_terceirizada = 14,
-- -- teste_fisico = 28, teste_fisico_terceirizada = 0 (ainda vazia, é normal).

-- =====================================================================
-- REVERSÃO, se precisar:
-- =====================================================================
-- update public.sistema_producao_itens set status = 'a_produzir'
--   where status = 'a_produzir_terceirizada';
-- update public.sistema_status set coluna_pcp = 'em_producao' where slug = 'a_produzir_terceirizada';
-- delete from public.sistema_status where slug = 'aguardando_teste_terceirizada';
-- (terceirizada_nome_livre preenchido no passo 5 não precisa reverter -- só ajuda, não atrapalha.)
