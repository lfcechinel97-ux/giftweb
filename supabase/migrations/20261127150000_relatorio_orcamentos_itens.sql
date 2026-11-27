-- =====================================================================
-- GIFT WEB - Relatório de orçamentos: itens "leves".
-- O jsonb `itens` guarda mockups/imagens; ler a coluna inteira de muitos
-- orçamentos estourava o tempo (statement timeout). Esta função devolve
-- só os campos que o relatório usa, recortados dentro do banco.
-- =====================================================================

create or replace function public.sistema_relatorio_orcamentos_itens(p_ids uuid[])
returns table (
  orcamento_id uuid,
  nome text,
  codigo text,
  quantidade numeric,
  preco_unitario numeric,
  personalizacao text,
  aplicacoes integer
)
language plpgsql stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin_user() then
    raise exception 'Not authorized';
  end if;

  return query
  select o.id,
         i.item->>'nome',
         i.item->>'codigoComposto',
         case when (i.item->>'quantidade') ~ '^-?[0-9]+(\.[0-9]+)?$' then (i.item->>'quantidade')::numeric end,
         case when (i.item->>'precoUnitario') ~ '^-?[0-9]+(\.[0-9]+)?$' then (i.item->>'precoUnitario')::numeric end,
         i.item->>'personalizacao',
         case when (i.item->>'aplicacoes') ~ '^[0-9]+$' then (i.item->>'aplicacoes')::integer end
    from public.sistema_orcamentos o
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(o.itens) = 'array' then o.itens else '[]'::jsonb end
    ) with ordinality as i(item, pos)
   where o.id = any(p_ids)
   order by o.id, i.pos;
end;
$$;

revoke all on function public.sistema_relatorio_orcamentos_itens(uuid[]) from public, anon;
grant execute on function public.sistema_relatorio_orcamentos_itens(uuid[]) to authenticated, service_role;

notify pgrst, 'reload schema';
