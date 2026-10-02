-- =====================================================================
-- GIFT WEB - Resolve "não identificado" no histórico do PCP para
-- entradas gravadas pelo gatilho automático (trg_hist_producao), que só
-- preenche usuario_id (quem estava logado), nunca vendedor_id -- esse só
-- é preenchido depois, por sistema_mudar_status_producao, quando a
-- mudança de etapa passa pelo quadro do PCP. Edição de quantidade/preço
-- do item e a transição inicial do pedido nunca passam por ali, então
-- ficavam com vendedor_id nulo pra sempre, mesmo sabendo quem foi.
--
-- sistema_listar_usuarios() já existe mas é só-admin (gerenciar contas);
-- esta é só leitura de nome, pra qualquer logado resolver "quem fez isso"
-- no histórico -- sem e-mail, sem papel, só id->nome.
-- =====================================================================
create or replace function public.sistema_nomes_usuarios()
returns table (user_id uuid, nome text)
language sql stable security definer set search_path = public as $$
  select a.id, coalesce(nullif(trim(a.nome), ''), a.email) as nome
    from public.admin_users a
$$;

revoke all on function public.sistema_nomes_usuarios() from public, anon;
grant execute on function public.sistema_nomes_usuarios() to authenticated;
