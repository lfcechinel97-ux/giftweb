do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure::text as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname='public' and p.prosecdef
      and p.proname in (
        'admin_search_products','admin_set_product_visibility','sistema_get_bootstrap',
        'sistema_get_custom_product_variants','sistema_get_orcamento','sistema_get_product_group',
        'sistema_list_custom_products','sistema_list_orcamentos','sistema_list_pedidos',
        'sistema_set_status_item','sistema_search_products')
  loop
    execute format('revoke all on function %s from anon, public', r.sig);
    execute format('grant execute on function %s to authenticated', r.sig);
  end loop;
end $$;