-- Mesma lógica da busca (lista inicial, sem termo digitado), mas SEM passar
-- pela checagem "is_admin_user()" -- é só para ver se a consulta em si roda
-- sem erro. Se isso aqui funcionar mas a tela continuar vazia, o problema
-- é a permissão de admin, não a busca.
with xbz as (
  select
    pc.id, pc.nome, pc.codigo_amigavel,
    coalesce(nullif(pc.codigo_prefixo, ''), split_part(pc.codigo_amigavel, '-', 1), pc.codigo_amigavel) as group_key,
    pc.is_variante, pc.ativo
  from public.products_cache pc
  where pc.ativo = true
), ranked as (
  select u.*,
    row_number() over (partition by group_key order by coalesce(is_variante,false) asc, length(codigo_amigavel), codigo_amigavel asc) as rn
  from xbz u
)
select codigo_amigavel, nome
from ranked
where rn = 1
order by codigo_amigavel
limit 10;

-- Testa se você mesmo (logado no SQL Editor) é reconhecido como admin --
-- isso só funciona se você rodar via "Run as authenticated user" ou
-- equivalente; no editor comum vem sempre NULL/false, então não é um teste
-- confiável de admin -- só confirma que a função abaixo existe:
select proname, prosecdef from pg_proc where proname = 'is_admin_user';
