-- =====================================================================
-- GIFT WEB - Migration Aditiva
-- Roda POR CIMA do schema que ja existe (sistema_orcamentos, sistema_pedidos,
-- sistema_clientes, sistema_vendedores, sistema_transportadoras,
-- products_cache, sistema_produtos_custom, sistema_ajustes_estoque).
-- NAO recria nenhuma tabela existente. So ALTER + CREATE do que falta.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 1) FORNECEDORES / TERCEIRIZADAS
--    sistema_transportadoras ja existe mas e so pra frete (entrega ao
--    cliente). Isso aqui e quem PRODUZ ou VENDE o produto.
-- ---------------------------------------------------------------------
create table if not exists sistema_fornecedores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text not null default 'fornecedor'
    check (tipo in ('fornecedor','terceirizada','ambos')),
  contato text,
  telefone text,           -- usado pro n8n disparar WhatsApp
  email text,
  cidade text,
  uf text,
  prazo_padrao_dias int,
  observacoes text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2) TECNICAS DE PERSONALIZACAO
-- ---------------------------------------------------------------------
create table if not exists sistema_tecnicas (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  local_padrao text not null default 'interna'
    check (local_padrao in ('interna','terceirizada')),
  prazo_padrao_dias int not null default 3,
  ativo boolean not null default true
);

insert into sistema_tecnicas (nome, local_padrao, prazo_padrao_dias) values
  ('Laser',             'interna',      2),
  ('DTF UV',            'terceirizada', 4),
  ('DTF Textil',        'terceirizada', 4),
  ('Silk Screen',       'terceirizada', 5),
  ('Sem Personalizacao','interna',      1)
on conflict (nome) do nothing;

-- ---------------------------------------------------------------------
-- 3) ITENS NORMALIZADOS (o coracao do PCP)   [SUBSTITUIDO PELO 08 — ver README]
--    Uma linha por item = uma Ordem de Producao.
--    Populado automaticamente a partir do jsonb `itens` quando o
--    orcamento vira pedido (trigger la embaixo).
-- ---------------------------------------------------------------------
create type status_item_producao as enum (
  'aguardando_arte',        -- vendedor precisa subir/aprovar mockup
  'aguardando_compra',      -- excecao: precisou comprar especifico pra esse pedido
  'fila_producao',          -- pronto pra entrar na maquina (caso comum: ja em estoque)
  'em_producao',
  'enviado_terceiro',
  'retornou_terceiro',
  'conferencia',
  'pronto',
  'expedido'
);

create type local_producao_tipo as enum (
  'interna', 'terceirizada', 'fornecedor_para_terceirizada'
);

create table if not exists sistema_pedido_itens (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references sistema_pedidos(id) on delete cascade,
  ordem int not null default 1,

  -- referencia ao produto (pode ser do catalogo XBZ ou custom, mantem
  -- os dois nulos se for produto avulso digitado a mao)
  produto_cache_id uuid references products_cache(id),
  produto_custom_id uuid references sistema_produtos_custom(id),
  codigo_composto text,             -- vem do item.codigoComposto
  nome text not null,               -- congela o nome no momento do pedido
  imagem_catalogo_url text,         -- foto do produto (nao e o mockup)

  quantidade numeric(12,3) not null,
  valor_unitario numeric(12,2) not null default 0,
  valor_total numeric(12,2) generated always as (quantidade * valor_unitario) stored,

  -- ORIGEM DO ESTOQUE — a peca que voce pediu pra destacar
  origem_estoque text not null default 'estoque'
    check (origem_estoque in ('estoque','compra_especifica')),
  compra_confirmada_em timestamptz,   -- so relevante quando origem = compra_especifica
  fornecedor_compra_id uuid references sistema_fornecedores(id),
  nota_fiscal_compra text,            -- opcional, nem toda compra tem NF

  -- ARTE / MOCKUP (nao existe hoje em nenhum lugar do sistema)
  tecnica_id uuid references sistema_tecnicas(id),
  descricao_personalizacao text,      -- vem do item.observacao
  mockup_url text,                    -- foto que aparece grande no PCP
  arte_aprovada_em timestamptz,

  -- PRODUCAO
  status status_item_producao not null default 'aguardando_arte',
  local_producao local_producao_tipo not null default 'interna',
  data_entrega_item date,

  -- TERCEIRIZADA (producao, nao confundir com fornecedor_compra_id)
  terceirizada_id uuid references sistema_fornecedores(id),
  enviado_terceiro_em timestamptz,
  previsao_retorno date,
  retornado_terceiro_em timestamptz,
  qtd_enviada numeric(12,3),
  qtd_retornada numeric(12,3),

  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pi_pedido on sistema_pedido_itens(pedido_id);
create index if not exists idx_pi_status on sistema_pedido_itens(status);
create index if not exists idx_pi_terceirizada on sistema_pedido_itens(terceirizada_id)
  where status = 'enviado_terceiro';
create index if not exists idx_pi_compra_pendente on sistema_pedido_itens(origem_estoque)
  where origem_estoque = 'compra_especifica' and compra_confirmada_em is null;

-- ---------------------------------------------------------------------
-- 4) COTACOES DE FRETE — historico, pra parar de recotar
--    sistema_orcamentos/sistema_pedidos guardam so a cotacao ESCOLHIDA.
--    Essa tabela guarda TODAS as cotacoes feitas pra aquele orcamento.
-- ---------------------------------------------------------------------
create table if not exists sistema_cotacoes_frete (
  id uuid primary key default gen_random_uuid(),
  orcamento_id uuid references sistema_orcamentos(id) on delete cascade,
  pedido_id uuid references sistema_pedidos(id) on delete cascade,
  transportadora_id uuid references sistema_transportadoras(id),
  transportadora_nome text,       -- caso nao esteja cadastrada
  valor numeric(12,2) not null,
  prazo_dias int,
  link_cotacao text,
  print_url text,
  cotado_por uuid references sistema_vendedores(id),
  cotado_em timestamptz not null default now(),
  valido_ate date,
  escolhida boolean not null default false,
  observacoes text,
  check (orcamento_id is not null or pedido_id is not null)
);
create index if not exists idx_cotacao_orc on sistema_cotacoes_frete(orcamento_id);
create index if not exists idx_cotacao_ped on sistema_cotacoes_frete(pedido_id);

-- ---------------------------------------------------------------------
-- 5) HISTORICO DE STATUS (auditoria de quem mudou o que)   [SUBSTITUIDO PELO 08 — ver README]
-- ---------------------------------------------------------------------
create table if not exists sistema_item_historico (
  id uuid primary key default gen_random_uuid(),
  pedido_item_id uuid not null references sistema_pedido_itens(id) on delete cascade,
  status_anterior status_item_producao,
  status_novo status_item_producao not null,
  usuario_id uuid,
  observacao text,
  created_at timestamptz not null default now()
);
create index if not exists idx_hist_item on sistema_item_historico(pedido_item_id, created_at desc);

create or replace function public.sistema_registrar_mudanca_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into sistema_item_historico (pedido_item_id, status_anterior, status_novo, usuario_id)
    values (new.id, old.status, new.status, auth.uid());
    new.updated_at = now();
  end if;
  return new;
end; $$;

drop trigger if exists trg_hist_status on sistema_pedido_itens;
create trigger trg_hist_status
  before update on sistema_pedido_itens
  for each row execute function public.sistema_registrar_mudanca_status();

-- ---------------------------------------------------------------------
-- 6) EXPLOSAO AUTOMATICA: pedido criado -> gera as linhas em
--    sistema_pedido_itens a partir do jsonb `itens`.   [REMOVIDO PELO 08 — ver README]
--    Dispara em INSERT (pedido novo) e em UPDATE se o array itens mudar.
-- ---------------------------------------------------------------------
create or replace function public.sistema_explodir_itens_pedido()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  item jsonb;
  v_ordem int := 0;
  v_tecnica_id uuid;
  v_local local_producao_tipo;
  v_obs text;
begin
  -- em update, se o array nao mudou, nao faz nada (evita duplicar)
  if tg_op = 'UPDATE' and new.itens is not distinct from old.itens then
    return new;
  end if;

  -- em update com array alterado, remove os itens antigos gerados daqui
  -- (nao mexe em itens que ja tiverem producao iniciada seria mais seguro,
  -- mas para o caso comum de edicao de orcamento isso e aceitavel)
  if tg_op = 'UPDATE' then
    delete from sistema_pedido_itens
      where pedido_id = new.id and status = 'aguardando_arte';
  end if;

  for item in select * from jsonb_array_elements(coalesce(new.itens, '[]'::jsonb))
  loop
    v_ordem := v_ordem + 1;
    v_obs := item->>'observacao';

    -- deteccao simples de tecnica pelo texto da observacao
    select id, local_padrao into v_tecnica_id, v_local
      from sistema_tecnicas
     where lower(unaccent(coalesce(v_obs,''))) like '%' || lower(unaccent(nome)) || '%'
        or lower(unaccent(coalesce(v_obs,''))) like
           case when nome = 'DTF UV' then '%dtf uv%'
                when nome = 'DTF Textil' then '%dtf textil%'
                when nome = 'Laser' then '%laser%'
                when nome = 'Silk Screen' then '%silk%'
                else '%__nunca__%' end
     order by case when nome = 'Sem Personalizacao' then 1 else 0 end desc
     limit 1;

    if v_tecnica_id is null then
      select id, local_padrao into v_tecnica_id, v_local
        from sistema_tecnicas where nome = 'Sem Personalizacao';
    end if;

    insert into sistema_pedido_itens (
      pedido_id, ordem, produto_cache_id, codigo_composto, nome,
      imagem_catalogo_url, quantidade, valor_unitario,
      tecnica_id, descricao_personalizacao, local_producao
    ) values (
      new.id, v_ordem,
      nullif(item->>'produtoId','')::uuid,
      item->>'codigoComposto',
      coalesce(item->>'nome','(sem nome)'),
      item->>'imagem',
      coalesce((item->>'quantidade')::numeric, 1),
      coalesce((item->>'precoUnitario')::numeric, 0),
      v_tecnica_id,
      v_obs,
      coalesce(v_local, 'interna')
    );
  end loop;

  return new;
end; $$;

-- precisa da extensao unaccent pra comparacao sem acento
create extension if not exists unaccent;

drop trigger if exists trg_explodir_itens on sistema_pedidos;
create trigger trg_explodir_itens
  after insert or update of itens on sistema_pedidos
  for each row execute function public.sistema_explodir_itens_pedido();

-- ---------------------------------------------------------------------
-- 7) VIEW: PAINEL "FORA DE CASA"
-- ---------------------------------------------------------------------
create or replace view vw_fora_de_casa as
select
  i.id, p.numero as pedido, c.nome as cliente, i.nome as produto,
  i.quantidade, i.qtd_enviada, t.nome as tecnica,
  f.nome as terceirizada, f.telefone as terceirizada_telefone,
  i.enviado_terceiro_em::date as enviado_em,
  i.previsao_retorno,
  current_date - i.enviado_terceiro_em::date as dias_fora,
  i.data_entrega_item, i.mockup_url, i.imagem_catalogo_url,
  case
    when i.previsao_retorno < current_date then 'atrasado'
    when i.previsao_retorno <= current_date + 1 then 'hoje_amanha'
    else 'ok'
  end as alerta
from sistema_pedido_itens i
join sistema_pedidos p on p.id = i.pedido_id
left join sistema_clientes c on c.id = p.cliente_id
left join sistema_fornecedores f on f.id = i.terceirizada_id
left join sistema_tecnicas t on t.id = i.tecnica_id
where i.status = 'enviado_terceiro'
order by i.previsao_retorno nulls last;

-- ---------------------------------------------------------------------
-- 8) VIEW: ITENS PENDENTES DE COMPRA (a excecao que voce quer ver clara)
-- ---------------------------------------------------------------------
create or replace view vw_pendentes_compra as
select
  i.id, p.numero as pedido, c.nome as cliente, i.nome as produto,
  i.quantidade, i.data_entrega_item,
  f.nome as fornecedor, i.created_at
from sistema_pedido_itens i
join sistema_pedidos p on p.id = i.pedido_id
left join sistema_clientes c on c.id = p.cliente_id
left join sistema_fornecedores f on f.id = i.fornecedor_compra_id
where i.origem_estoque = 'compra_especifica'
  and i.compra_confirmada_em is null
order by i.data_entrega_item nulls last;

-- ---------------------------------------------------------------------
-- 9) RLS — mesma politica simples das tabelas sistema_* existentes
-- ---------------------------------------------------------------------
alter table sistema_fornecedores    enable row level security;
alter table sistema_tecnicas        enable row level security;
alter table sistema_pedido_itens    enable row level security;
alter table sistema_cotacoes_frete  enable row level security;
alter table sistema_item_historico  enable row level security;

do $$
declare t text;
begin
  foreach t in array array['sistema_fornecedores','sistema_tecnicas',
    'sistema_pedido_itens','sistema_cotacoes_frete','sistema_item_historico']
  loop
    execute format(
      'create policy "auth_all_%1$s" on %1$I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 10) STORAGE — bucket pra mockup (nao existia)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('mockups','mockups',true), ('cotacoes','cotacoes',true)
on conflict (id) do nothing;

create policy "storage_mockups_auth" on storage.objects for all to authenticated
  using (bucket_id in ('mockups','cotacoes'))
  with check (bucket_id in ('mockups','cotacoes'));

create policy "storage_mockups_public_read" on storage.objects for select to public
  using (bucket_id in ('mockups','cotacoes'));

-- =====================================================================
-- CONFERENCIA — roda depois de aprovar um orcamento de teste
-- =====================================================================
-- select p.numero, count(i.id) itens
--   from sistema_pedidos p join sistema_pedido_itens i on i.pedido_id = p.id
--  group by p.numero order by p.numero desc limit 5;
