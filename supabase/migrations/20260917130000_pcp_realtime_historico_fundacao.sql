-- =====================================================================
-- GIFT WEB - PCP Fase 1: Realtime + historico com responsavel real
--            + fundacao de schema para as fases seguintes (anexos,
--            volumes de expedicao, terceirizada por nome livre).
--
-- Contexto importante (nao mexer sem reler): existe UM UNICO login no
-- sistema (lfcechinel97@gmail.com) usado por toda a equipe. "Vendedor
-- selecionado" no cabecalho (dropdown, sem autenticacao por tras) e a
-- UNICA identidade individual que existe hoje -- por isso o historico
-- passa a gravar vendedor_id em vez de depender so de auth.uid(), que
-- e sempre a mesma pessoa fisica.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Historico ganha vendedor_id (quem estava selecionado no cabecalho
--    no momento da acao). usuario_id (auth.uid()) continua existindo,
--    mas sozinho so diz "alguem mexeu", nunca quem.
-- ---------------------------------------------------------------------
alter table public.sistema_producao_historico
  add column if not exists vendedor_id uuid references public.sistema_vendedores(id);

create index if not exists idx_producao_historico_item_data
  on public.sistema_producao_historico (producao_item_id, created_at desc);

-- ---------------------------------------------------------------------
-- 2) RPC unica para mudar status: dispara o trigger existente
--    (sistema_registrar_mudanca_producao, que grava status_anterior/novo
--    + created_at) e, no MESMO round-trip, carimba vendedor_id na linha
--    de historico que acabou de nascer. Evita call duplo do front e
--    corrida entre "salvar status" e "salvar quem mudou".
-- ---------------------------------------------------------------------
create or replace function public.sistema_mudar_status_producao(
  p_producao_id uuid,
  p_status text,
  p_vendedor_id uuid default null,
  p_observacao text default null
)
returns public.sistema_producao_itens
language plpgsql
volatile security definer
set search_path to 'public'
as $function$
declare
  v_item public.sistema_producao_itens;
  v_hist_id uuid;
begin
  update public.sistema_producao_itens
     set status = p_status
   where id = p_producao_id
  returning * into v_item;

  if not found then
    raise exception 'Item de producao % nao encontrado', p_producao_id;
  end if;

  -- a linha de historico so nasce se o status realmente mudou (trigger
  -- so insere quando old.status is distinct from new.status)
  select h.id into v_hist_id
    from public.sistema_producao_historico h
   where h.producao_item_id = p_producao_id
   order by h.created_at desc
   limit 1;

  if v_hist_id is not null then
    update public.sistema_producao_historico
       set vendedor_id = p_vendedor_id,
           observacao = coalesce(p_observacao, observacao)
     where id = v_hist_id;
  end if;

  return v_item;
end;
$function$;

grant execute on function public.sistema_mudar_status_producao(uuid, text, uuid, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 3) Fundacao de schema para as proximas fases (colunas paradas ate a
--    UI usar, mas evita nova migration a cada passo pequeno):
--
--    Fase 3/4 -- anexo de teste fisico e de producao concluida
--    Fase 5    -- terceirizada por nome livre (nao precisa estar
--                 cadastrada em sistema_fornecedores) + volumes de
--                 expedicao no PEDIDO (nao no item -- o popup so abre
--                 quando TODOS os itens do pedido chegam em Expedicao,
--                 entao a medida e do pacote fisico, nao da peca).
-- ---------------------------------------------------------------------
alter table public.sistema_producao_itens
  add column if not exists teste_anexo_url text,
  add column if not exists teste_enviado_em timestamptz,
  add column if not exists producao_anexo_url text,
  add column if not exists producao_anexo_tipo text
    check (producao_anexo_tipo in ('foto', 'video')),
  add column if not exists producao_anexo_em timestamptz,
  add column if not exists terceirizada_nome_livre text;

alter table public.sistema_pedidos
  add column if not exists volumes jsonb not null default '[]'::jsonb,
  -- cada elemento: {"comprimento":cm,"altura":cm,"largura":cm,"peso":kg}
  add column if not exists pago_integral boolean not null default false,
  add column if not exists pago_integral_em timestamptz,
  add column if not exists pago_integral_por uuid references public.sistema_vendedores(id);

-- ---------------------------------------------------------------------
-- 3b) vw_pcp ganha o que os proximos passos precisam ler, pra nao exigir
--     outra migration a cada fase:
--       - item_criado_em: timer de "tempo TOTAL desde que entrou no
--         sistema" precisa da data de criacao crua, nao da ultima
--         mudanca de status (que e o que etapa_desde/horas_na_etapa ja
--         davam)
--       - teste_anexo_url/teste_enviado_em/producao_anexo_url/
--         producao_anexo_tipo/terceirizada_nome_livre: colunas novas
--         do item 3
--       - itens_expedicao_pedido: quantos itens do pedido ja estao na
--         coluna 'aguardando_coleta' (rotulo "Expedicao" no board) --
--         o popup de volumes so abre quando esse numero bate com
--         total_itens_pedido
-- ---------------------------------------------------------------------
drop view if exists public.vw_pcp;
create view public.vw_pcp as
select
  pi.id as producao_id,
  p.id as pedido_id,
  p.numero as pedido_numero,
  public.sistema_cor_pedido(p.numero) as pedido_cor,
  c.nome as cliente,
  it.item ->> 'nome'          as produto_nome,
  it.item ->> 'mockupImagem'  as mockup_url,
  it.item ->> 'imagem'        as imagem_catalogo_url,
  (it.item ->> 'quantidade')::numeric    as quantidade,
  (it.item ->> 'precoUnitario')::numeric as valor_unitario,
  it.item ->> 'observacao'    as item_observacao,
  pi.status,
  s.nome       as status_nome,
  s.cor        as status_cor,
  s.coluna_pcp as coluna_pcp,
  pi.local_producao,
  pi.origem_estoque,
  pi.data_entrega_item,
  pi.tecnica_id,
  t.nome as tecnica_nome,
  pi.terceirizada_id,
  f.nome as terceirizada_nome,
  f.telefone as terceirizada_telefone,
  pi.terceirizada_nome_livre,
  pi.enviado_terceiro_em,
  pi.previsao_retorno,
  pi.qtd_enviada,
  pi.qtd_retornada,
  pi.compra_confirmada_em,
  pi.fornecedor_compra_id,
  pi.medidas_ok,
  pi.pagamento_ok,
  pi.etiqueta_ok,
  pi.coleta_solicitada_em,
  pi.pagamento_cartao_conferido_em,
  pi.pix_recebido_integral_em,
  pi.teste_anexo_url,
  pi.teste_enviado_em,
  pi.producao_anexo_url,
  pi.producao_anexo_tipo,
  pi.producao_anexo_em,
  pi.tags,
  pi.created_at as item_criado_em,
  mp.nome as pagamento_nome,
  p.total as pedido_total,
  p.observacoes as pedido_observacoes,
  p.volumes as pedido_volumes,
  p.pago_integral as pedido_pago_integral,
  h.ultima_mudanca as etapa_desde,
  extract(epoch from (now() - h.ultima_mudanca)) / 3600::numeric as horas_na_etapa,
  (select count(*) from public.sistema_producao_itens x
    where x.pedido_id = p.id) as total_itens_pedido,
  (select count(*) from public.sistema_producao_itens x
     join public.sistema_status sx on sx.slug = x.status
    where x.pedido_id = p.id and sx.coluna_pcp = 'enviado') as itens_enviados_pedido,
  (select count(*) from public.sistema_producao_itens x
     join public.sistema_status sx on sx.slug = x.status
    where x.pedido_id = p.id and sx.coluna_pcp = 'aguardando_coleta') as itens_expedicao_pedido
from public.sistema_producao_itens pi
join public.sistema_pedidos p on p.id = pi.pedido_id
join public.sistema_status s on s.slug = pi.status
left join public.sistema_clientes c on c.id = p.cliente_id
left join public.sistema_tecnicas t on t.id = pi.tecnica_id
left join public.sistema_fornecedores f on f.id = pi.terceirizada_id
left join public.sistema_meios_pagamento mp on mp.id = p.pagamento_id
-- CROSS (nao LEFT) de proposito: linha de producao cujo item sumiu do jsonb
-- e orfa e continua fora do PCP, exatamente como antes.
cross join lateral (
  select e.value as item
  from jsonb_array_elements(p.itens) e
  where (e.value ->> 'id')::uuid = pi.item_id
  limit 1
) it
left join lateral (
  select coalesce(
    (select hh.created_at from public.sistema_producao_historico hh
      where hh.producao_item_id = pi.id
      order by hh.created_at desc limit 1),
    pi.created_at) as ultima_mudanca
) h on true
where s.coluna_pcp <> 'cancelado'
  and p.status <> 'cancelado';

grant select on public.vw_pcp to authenticated;

-- ---------------------------------------------------------------------
-- 4) Realtime: sem isso, mudanca de coluna feita numa aba so aparece
--    para outra aba/usuario apos refresh manual -- exatamente o que a
--    fase 1 elimina.
-- ---------------------------------------------------------------------
alter table public.sistema_producao_itens     replica identity full;
alter table public.sistema_producao_historico replica identity full;
alter table public.sistema_pedidos            replica identity full;

do $$
declare t text;
begin
  foreach t in array array[
    'sistema_producao_itens',
    'sistema_producao_historico',
    'sistema_pedidos'
  ] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception
      when duplicate_object then null;  -- ja publicada
      when undefined_object then null;  -- publicacao nao existe neste ambiente
    end;
  end loop;
end $$;
