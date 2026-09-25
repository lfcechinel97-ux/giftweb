-- Troca o laranja-amarronzado (#C2410C) por um laranja mais vivo.
update public.sistema_status set cor = '#EA580C' where cor = '#C2410C';
-- Etiquetas antigas "TERCEIRIZADA + nome" passam a "TERCEIRIZADA - nome".
update public.sistema_producao_itens
   set tags = (select coalesce(array_agg(regexp_replace(t, '^(TERCEIRIZADA)\s*\+\s*', '\1 - ', 'i')), '{}')
                 from unnest(tags) as t)
 where exists (select 1 from unnest(tags) as t where t ~* '^TERCEIRIZADA\s*\+');
