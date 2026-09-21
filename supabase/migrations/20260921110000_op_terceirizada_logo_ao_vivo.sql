-- =====================================================================
-- GIFT WEB - O.P. terceirizada: a logo do link passa a ser resolvida na
-- hora em que o link é aberto, não congelada na geração.
--
-- Ordem: a logo mais recente anexada ao item no PCP (categoria 'logo')
-- e, se não houver, a arte que veio do pedido. Assim a produção pode
-- trocar a logo no próprio item e o link que já foi enviado para a
-- terceirizada passa a mostrar a nova, sem gerar outro.
-- =====================================================================

create or replace function public.sistema_op_terceirizada_publica(p_token uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'dimensao_tipo', l.dimensao_tipo,
    'dimensao_cm', l.dimensao_cm,
    'conteudo', jsonb_set(
      l.conteudo, '{arte_url}',
      coalesce(
        to_jsonb((
          select a.url from public.sistema_producao_anexos a
          where a.producao_item_id = l.producao_item_id and a.categoria = 'logo'
          order by a.created_at desc limit 1
        )),
        l.conteudo -> 'arte_url',
        'null'::jsonb
      )
    ),
    'criado_em', l.criado_em,
    'expira_em', l.expira_em
  )
  from public.sistema_op_terceirizada_links l
  where l.id = p_token and l.expira_em > now();
$$;

revoke all on function public.sistema_op_terceirizada_publica(uuid) from public;
grant execute on function public.sistema_op_terceirizada_publica(uuid) to anon, authenticated;
