-- =====================================================================
-- GIFT WEB - Correcao: remove o trigger de explosao (conflitava com
-- aprovarOrcamento() do SistemaContext.tsx) e cria tabela SATELITE de
-- producao, referenciando os itens pelo id que ja existe dentro do
-- jsonb sistema_pedidos.itens.
--
-- Rodar DEPOIS do 05_migration_aditiva.sql (mantem sistema_fornecedores,
-- sistema_tecnicas e sistema_cotacoes_frete de la — essas continuam
-- validas). Este arquivo substitui APENAS a parte de
-- sistema_pedido_itens + trg_explodir_itens daquela migration.
-- =====================================================================

-- 1) Desliga e remove o trigger que duplicava a logica do JS
drop trigger if exists trg_explodir_itens on sistema_pedidos;
drop function if exists public.sistema_explodir_itens_pedido();

-- 2) Se a tabela sistema_pedido_itens antiga chegou a ser usada, mantenha
--    por enquanto (nao apagar dados). Ela so deixa de receber gravacao
--    automatica. Pode ser removida depois de confirmar que nada mais
--    referencia ela:
--    drop table if exists sistema_pedido_itens cascade;

-- 3) TABELA SATELITE — nao tem FK de verdade pro item (ele mora dentro
--    do jsonb sistema_pedidos.itens), so guarda o item_id como uuid solto.
--    pedido_id tem FK normal, essa referencia e real.
create table if not exists sistema_producao_itens (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references sistema_pedidos(id) on delete cascade,
  item_id uuid not null,        -- = PedidoItem.id dentro do jsonb itens[]

  -- origem do estoque (a peca que voce pediu pra destacar)
  origem_estoque text not null default 'estoque'
    check (origem_estoque in ('estoque','compra_especifica')),
  compra_confirmada_em timestamptz,
  fornecedor_compra_id uuid references sistema_fornecedores(id),
  nota_fiscal_compra text,

  -- personalizacao / producao
  tecnica_id uuid references sistema_tecnicas(id),
  descricao_personalizacao text,
  arte_aprovada_em timestamptz,

  status text not null default 'aguardando_arte'
    check (status in ('aguardando_arte','aguardando_compra','fila_producao',
                       'em_producao','enviado_terceiro','retornou_terceiro',
                       'conferencia','pronto','expedido')),
  local_producao text not null default 'interna'
    check (local_producao in ('interna','terceirizada','fornecedor_para_terceirizada')),
  data_entrega_item date,

  terceirizada_id uuid references sistema_fornecedores(id),
  enviado_terceiro_em timestamptz,
  previsao_retorno date,
  retornado_terceiro_em timestamptz,
  qtd_enviada numeric(12,3),
  qtd_retornada numeric(12,3),

  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (pedido_id, item_id)   -- um registro de producao por item
);

create index if not exists idx_prod_pedido on sistema_producao_itens(pedido_id);
create index if not exists idx_prod_status on sistema_producao_itens(status);
create index if not exists idx_prod_terceirizada on sistema_producao_itens(terceirizada_id)
  where status = 'enviado_terceiro';

-- 4) Historico de status (auditoria)
create table if not exists sistema_producao_historico (
  id uuid primary key default gen_random_uuid(),
  producao_item_id uuid not null references sistema_producao_itens(id) on delete cascade,
  status_anterior text,
  status_novo text not null,
  usuario_id uuid,
  observacao text,
  created_at timestamptz not null default now()
);

create or replace function public.sistema_registrar_mudanca_producao()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into sistema_producao_historico (producao_item_id, status_anterior, status_novo, usuario_id)
    values (new.id, old.status, new.status, auth.uid());
    new.updated_at = now();
  end if;
  return new;
end; $$;

drop trigger if exists trg_hist_producao on sistema_producao_itens;
create trigger trg_hist_producao
  before update on sistema_producao_itens
  for each row execute function public.sistema_registrar_mudanca_producao();

-- 5) Gatilho leve: quando um pedido NOVO e criado (aprovarOrcamento fez o
--    insert), cria automaticamente uma linha satelite "vazia" (status
--    padrao) pra cada item do jsonb, usando o id que cada item ja tem.
--    Isso SO roda em INSERT (pedido novo), nunca em UPDATE — assim nao
--    briga com edicoes feitas pela tela depois.
create or replace function public.sistema_criar_producao_inicial()
returns trigger language plpgsql security definer set search_path = public as $$
declare item jsonb;
begin
  for item in select * from jsonb_array_elements(coalesce(new.itens, '[]'::jsonb))
  loop
    insert into sistema_producao_itens (pedido_id, item_id)
    values (new.id, (item->>'id')::uuid)
    on conflict (pedido_id, item_id) do nothing;
  end loop;
  return new;
end; $$;

drop trigger if exists trg_producao_inicial on sistema_pedidos;
create trigger trg_producao_inicial
  after insert on sistema_pedidos
  for each row execute function public.sistema_criar_producao_inicial();

-- 6) RLS
alter table sistema_producao_itens     enable row level security;
alter table sistema_producao_historico enable row level security;

do $$
declare t text;
begin
  foreach t in array array['sistema_producao_itens','sistema_producao_historico']
  loop
    execute format(
      'create policy "auth_all_%1$s" on %1$I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- 7) VIEW auxiliar: junta o item do jsonb com a linha de producao —
--    facilita muito a query da tela de PCP (nome, mockup, qtd sem ter que
--    fazer o join no front).
create or replace view vw_pcp as
select
  pi.id as producao_id,
  p.id as pedido_id,
  p.numero as pedido_numero,
  c.nome as cliente,
  item->>'nome' as produto_nome,
  item->>'mockupImagem' as mockup_url,
  item->>'imagem' as imagem_catalogo_url,
  (item->>'quantidade')::numeric as quantidade,
  (item->>'precoUnitario')::numeric as valor_unitario,
  pi.status, pi.local_producao, pi.origem_estoque,
  pi.data_entrega_item, pi.tecnica_id, t.nome as tecnica_nome,
  pi.terceirizada_id, f.nome as terceirizada_nome, f.telefone as terceirizada_telefone,
  pi.enviado_terceiro_em, pi.previsao_retorno, pi.qtd_enviada, pi.qtd_retornada,
  pi.compra_confirmada_em, pi.fornecedor_compra_id
from sistema_producao_itens pi
join sistema_pedidos p on p.id = pi.pedido_id
left join sistema_clientes c on c.id = p.cliente_id
left join sistema_tecnicas t on t.id = pi.tecnica_id
left join sistema_fornecedores f on f.id = pi.terceirizada_id
cross join lateral jsonb_array_elements(p.itens) as item
where (item->>'id')::uuid = pi.item_id
  and p.status <> 'cancelado';

-- =====================================================================
-- CONFERENCIA (rodar depois de aprovar um orcamento de teste)
-- =====================================================================
-- select pedido_numero, produto_nome, quantidade, status, tecnica_nome
--   from vw_pcp order by pedido_numero desc limit 20;
