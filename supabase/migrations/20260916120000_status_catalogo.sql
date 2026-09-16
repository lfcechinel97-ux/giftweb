-- =====================================================================
-- GIFT WEB - Status como CATALOGO editavel (nao mais check constraint)
--
-- Motivo: os status do pedido e do item sao campos customizados — o
-- usuario adiciona/remove/renomeia em Configuracoes. Um check constraint
-- exigiria migration a cada mudanca, entao vira tabela.
--
-- Compatibilidade preservada:
--   - sistema_producao_itens mantem a coluna `status` (text, mesmo nome)
--   - trg_producao_inicial e trg_hist_producao seguem intactos
--   - vw_pcp mantem todas as colunas atuais e ganha coluna_pcp/status_nome/
--     status_cor; o Kanban continua com as mesmas 8 colunas
--
-- Rodar DEPOIS de 09_ajusta_status_pcp.sql (ver migrations_historico).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Catalogo
-- ---------------------------------------------------------------------
create table if not exists public.sistema_status (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,               -- estavel; o codigo referencia isto
  nome text not null,                      -- rotulo editavel na tela
  cor text not null default '#6B7280',
  ordem int not null default 0,

  -- Em qual das 8 colunas do Kanban do PCP este status cai. As colunas sao
  -- estruturais (fazem parte do layout do PCP), os status dentro delas nao.
  coluna_pcp text not null default 'organizando_pedido'
    check (coluna_pcp in (
      'organizando_pedido','pronto_producao','teste_fisico','preparacao',
      'em_producao','embalagem_pagamento','aguardando_coleta','enviado','cancelado')),

  escopo text not null default 'ambos' check (escopo in ('pedido','item','ambos')),
  ativo boolean not null default true,

  -- Status dos quais o codigo depende: nao podem ser apagados (podem ser
  -- renomeados e recoloridos a vontade).
  protegido boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_status_ordem on public.sistema_status (ativo, ordem);

grant select, insert, update, delete on public.sistema_status to authenticated;
grant all on public.sistema_status to service_role;
alter table public.sistema_status enable row level security;

drop policy if exists "auth le status" on public.sistema_status;
create policy "auth le status" on public.sistema_status
  for select to authenticated using (true);

drop policy if exists "admin escreve status" on public.sistema_status;
create policy "admin escreve status" on public.sistema_status
  for all to authenticated
  using ((select public.is_admin_user())) with check ((select public.is_admin_user()));

create or replace function public.sistema_status_protegido()
returns trigger language plpgsql as $fn$
begin
  if old.protegido then
    raise exception 'O status "%" e usado pelo sistema e nao pode ser excluido. Desative-o em vez de excluir.', old.nome;
  end if;
  return old;
end; $fn$;

drop trigger if exists trg_status_protegido on public.sistema_status;
create trigger trg_status_protegido
  before delete on public.sistema_status
  for each row execute function public.sistema_status_protegido();

-- ---------------------------------------------------------------------
-- 2) Seed: os 13 status do Calcme, na ordem do fluxo
-- ---------------------------------------------------------------------
insert into public.sistema_status (slug, nome, cor, ordem, coluna_pcp, escopo, protegido) values
  ('organizando_anotacoes',   'Organizando anotações',        '#64748B',  10, 'organizando_pedido',  'ambos',  true),
  ('imprimir_ordem_producao', 'Imprimir ordem de produção',   '#0EA5E9',  20, 'pronto_producao',     'ambos',  false),
  ('aguardando_mercadoria',   'Aguardando mercadoria',        '#F59E0B',  30, 'pronto_producao',     'ambos',  false),
  ('aguardando_teste',        'Aguardando teste laser/DTF',   '#A855F7',  40, 'teste_fisico',        'ambos',  false),
  ('preparar_dtf',            'Preparar DTF/vetorização',     '#8B5CF6',  50, 'preparacao',          'ambos',  false),
  ('a_produzir',              'A produzir',                   '#2563EB',  60, 'em_producao',         'ambos',  false),
  ('a_produzir_terceirizada', 'A produzir terceirizada',      '#1D4ED8',  70, 'em_producao',         'ambos',  false),
  ('inserir_medidas',         'Inserir medidas',              '#0D9488',  80, 'embalagem_pagamento', 'ambos',  false),
  ('conferir_pagamentos',     'Conferir pagamentos',          '#059669',  90, 'embalagem_pagamento', 'ambos',  false),
  ('enviar_etiqueta',         'Enviar etiqueta/expedição',    '#16A34A', 100, 'embalagem_pagamento', 'ambos',  false),
  ('aguardando_coleta',       'Aguardando coleta',            '#CA8A04', 110, 'aguardando_coleta',   'ambos',  false),
  ('coletado_enviado',        'Coletado e enviado',           '#15803D', 120, 'enviado',             'ambos',  true),
  ('entregue',                'Entregue',                     '#166534', 130, 'enviado',             'pedido', false),
  ('cancelado',               'Cancelado',                    '#DC2626', 140, 'cancelado',           'ambos',  true)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- 3) sistema_producao_itens.status -> slugs do catalogo
--    Os 9 status antigos viram 13: o que o Calcme achatava em status, o
--    banco guardava em colunas separadas (local_producao, origem_estoque,
--    checklist). Aqui a informacao volta para o status, sem perder as
--    colunas — elas continuam existindo e sendo gravadas.
-- ---------------------------------------------------------------------
alter table public.sistema_producao_itens
  drop constraint if exists sistema_producao_itens_status_check;

update public.sistema_producao_itens set status = case
  when status = 'organizando_pedido'  then 'organizando_anotacoes'
  when status = 'pronto_producao'     then
    case when origem_estoque = 'compra_especifica' and compra_confirmada_em is null
         then 'aguardando_mercadoria' else 'imprimir_ordem_producao' end
  when status = 'teste_fisico'        then 'aguardando_teste'
  when status = 'preparacao'          then 'preparar_dtf'
  when status = 'em_producao'         then
    case when local_producao in ('terceirizada','fornecedor_para_terceirizada')
         then 'a_produzir_terceirizada' else 'a_produzir' end
  when status = 'embalagem_pagamento' then
    case when not medidas_ok   then 'inserir_medidas'
         when not pagamento_ok then 'conferir_pagamentos'
         else 'enviar_etiqueta' end
  when status = 'aguardando_coleta'   then 'aguardando_coleta'
  when status = 'enviado'             then 'coletado_enviado'
  when status = 'cancelado'           then 'cancelado'
  else status
end;

-- rede de seguranca: qualquer valor inesperado nao pode derrubar a FK
update public.sistema_producao_itens
   set status = 'organizando_anotacoes'
 where status is null
    or status not in (select slug from public.sistema_status);

alter table public.sistema_producao_itens alter column status set default 'organizando_anotacoes';

alter table public.sistema_producao_itens
  drop constraint if exists fk_producao_itens_status;
alter table public.sistema_producao_itens
  add constraint fk_producao_itens_status foreign key (status)
  references public.sistema_status(slug) on update cascade on delete restrict;

-- ---------------------------------------------------------------------
-- 4) sistema_pedidos.status -> mesmos slugs (era texto livre: novo,
--    producao, pronto, enviado, entregue, cancelado)
-- ---------------------------------------------------------------------
update public.sistema_pedidos set status = case status
  when 'novo'      then 'organizando_anotacoes'
  when 'producao'  then 'a_produzir'
  when 'pronto'    then 'aguardando_coleta'
  when 'enviado'   then 'coletado_enviado'
  when 'entregue'  then 'entregue'
  when 'cancelado' then 'cancelado'
  else status
end;

update public.sistema_pedidos
   set status = 'organizando_anotacoes'
 where status is null
    or status not in (select slug from public.sistema_status);

alter table public.sistema_pedidos alter column status set default 'organizando_anotacoes';

alter table public.sistema_pedidos drop constraint if exists fk_pedidos_status;
alter table public.sistema_pedidos
  add constraint fk_pedidos_status foreign key (status)
  references public.sistema_status(slug) on update cascade on delete restrict;

-- ---------------------------------------------------------------------
-- 5) Indices (requisito de performance)
--    OBS: sem CONCURRENTLY porque migration roda dentro de transacao. Se
--    as tabelas ja estiverem grandes, rode as versoes CONCURRENTLY a mao
--    no SQL editor ANTES desta migration — aqui viram no-op.
-- ---------------------------------------------------------------------
create index if not exists idx_prod_pedido_status_criado
  on public.sistema_producao_itens (pedido_id, status, created_at);

create index if not exists idx_pedidos_created_at
  on public.sistema_pedidos (created_at desc);

create index if not exists idx_pedidos_status_created
  on public.sistema_pedidos (status, created_at desc);

create extension if not exists pg_trgm;

create index if not exists idx_pedidos_numero_trgm
  on public.sistema_pedidos using gin (numero gin_trgm_ops);

create index if not exists idx_pedidos_contato_nome_trgm
  on public.sistema_pedidos using gin (contato_nome gin_trgm_ops);

-- ---------------------------------------------------------------------
-- 6) RLS em InitPlan — is_admin_user() era avaliada UMA VEZ POR LINHA
--    varrida. Com (select ...) o Postgres promove a InitPlan e avalia uma
--    vez por query.
-- ---------------------------------------------------------------------
do $rls$
declare t text;
begin
  foreach t in array array[
    'sistema_pedidos','sistema_orcamentos','sistema_clientes','sistema_ajustes_estoque']
  loop
    execute format('drop policy if exists "admin all" on public.%I', t);
    execute format(
      'create policy "admin all" on public.%I for all to authenticated '
      'using ((select public.is_admin_user())) with check ((select public.is_admin_user()))', t);
  end loop;
end $rls$;

-- ---------------------------------------------------------------------
-- 7) vw_pcp recriada
--    (a) ganha coluna_pcp / status_nome / status_cor vindos do catalogo
--    (b) o cross join lateral ganhou LIMIT 1: antes, para CADA linha de
--        producao o Postgres expandia TODOS os itens do jsonb do pedido e
--        so depois filtrava — O(n^2) por pedido (um pedido de 15 itens =
--        225 expansoes). Com LIMIT 1 ele para na primeira correspondencia.
--        Continua CROSS (nao LEFT) para nao criar card fantasma.
--    (c) itens_enviados_pedido conta pela COLUNA 'enviado', nao pelo
--        slug — assim status novos criados pelo usuario que caiam nessa
--        coluna contam junto.
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
  pi.tags,
  mp.nome as pagamento_nome,
  p.total as pedido_total,
  p.observacoes as pedido_observacoes,
  h.ultima_mudanca as etapa_desde,
  extract(epoch from (now() - h.ultima_mudanca)) / 3600::numeric as horas_na_etapa,
  (select count(*) from public.sistema_producao_itens x
    where x.pedido_id = p.id) as total_itens_pedido,
  (select count(*) from public.sistema_producao_itens x
     join public.sistema_status sx on sx.slug = x.status
    where x.pedido_id = p.id and sx.coluna_pcp = 'enviado') as itens_enviados_pedido
from public.sistema_producao_itens pi
join public.sistema_pedidos p on p.id = pi.pedido_id
join public.sistema_status s on s.slug = pi.status
left join public.sistema_clientes c on c.id = p.cliente_id
left join public.sistema_tecnicas t on t.id = pi.tecnica_id
left join public.sistema_fornecedores f on f.id = pi.terceirizada_id
left join public.sistema_meios_pagamento mp on mp.id = p.pagamento_id
-- CROSS (nao LEFT) de proposito: linha de producao cujo item sumiu do jsonb
-- e orfa e continua fora do PCP, exatamente como antes. Trocar por LEFT faria
-- aparecer card fantasma sem nome — ex.: o item "Frete FOB" que a sync agora
-- remove do jsonb deixa para tras a linha de producao criada antes.
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
