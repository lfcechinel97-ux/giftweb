-- =====================================================================
-- GIFT WEB - /whatsapp: SDR x consultor, seleção/avaliação em conjunto e
-- leads do Meta Ads.
--   comercial_conversas: mensagens compactas (para recalcular quem mandou
--     o quê sem buscar de novo no Data Crazy), contagem de mensagens do SDR
--     e do consultor, quando o SDR passou ("Resumo do projeto") e quando o
--     consultor entrou, e o tamanho da transcrição (estimativa de tokens).
--   comercial_diagnosticos: agora também avalia uma SELEÇÃO de conversas,
--     com instruções próprias; guarda título, escopo e tokens gastos.
--   comercial_leads_meta: leads da planilha do Meta Ads, ligados às
--     conversas por telefone, e-mail, nome e horário.
-- =====================================================================

alter table public.comercial_conversas
  add column if not exists mensagens jsonb,
  add column if not exists mensagens_sdr integer,
  add column if not exists mensagens_consultor integer,
  add column if not exists handoff_em timestamptz,
  add column if not exists consultor_entrou_em timestamptz,
  add column if not exists emails text[],
  add column if not exists transcricao_caracteres integer
    generated always as (coalesce(length(transcricao), 0)) stored;

alter table public.comercial_diagnosticos
  add column if not exists titulo text,
  add column if not exists instrucoes text,
  add column if not exists escopo jsonb,
  add column if not exists modo text,              -- 'transcricoes' | 'analises'
  add column if not exists tokens_entrada integer,
  add column if not exists tokens_saida integer;

create table if not exists public.comercial_leads_meta (
  id uuid primary key default gen_random_uuid(),
  chave text not null unique,                      -- id do lead na planilha (ou hash da linha)
  importado_em timestamptz not null default now(),
  nome text,
  telefone text,
  email text,
  lead_criado_em timestamptz,
  campanha text,
  conjunto text,
  anuncio text,
  formulario text,
  plataforma text,
  dados jsonb,                                     -- a linha inteira da planilha
  conversa_id text references public.comercial_conversas(id) on delete set null,
  vinculo_metodo text,                             -- telefone | email | nome_horario | horario | manual
  vinculo_score integer,
  vinculado_em timestamptz
);

create index if not exists comercial_leads_meta_conversa_idx on public.comercial_leads_meta (conversa_id);

alter table public.comercial_leads_meta enable row level security;

drop policy if exists "admin gerencia leads do meta" on public.comercial_leads_meta;
create policy "admin gerencia leads do meta" on public.comercial_leads_meta
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

revoke all on public.comercial_leads_meta from anon;
grant select, insert, update, delete on public.comercial_leads_meta to authenticated;
grant all on public.comercial_leads_meta to service_role;