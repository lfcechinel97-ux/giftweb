-- =====================================================================
-- GIFT WEB - Anexos gerais do pedido (briefing, arte solta, logo do
-- cliente) -- parte da reformulação da tela de criar/editar pedido.
--
-- sistema_orcamentos já tem um anexo_url (um arquivo só). Pedido pode
-- ter vários (briefing + várias artes), então é array jsonb, não uma
-- coluna de URL única -- mesmo padrão já usado em
-- sistema_pedidos.volumes (array jsonb) da fase de expedição do PCP.
-- =====================================================================

alter table public.sistema_pedidos
  add column if not exists anexos jsonb not null default '[]'::jsonb;
  -- cada elemento: {"url": text, "nome": text, "tipo": "foto"|"video"|"pdf"|"outro", "criadoEm": timestamptz text}
