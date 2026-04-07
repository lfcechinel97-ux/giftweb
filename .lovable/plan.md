

# Aplicar migração de variantes — caminho correto

## Situação atual

- O arquivo `supabase/migrations/20260406203900_fix_variantes_grouping.sql` **já existe** no projeto
- A Edge Function `sync-products` **foi deployada** com sucesso
- A migração **não foi aplicada** porque `psql` não tem permissão para UPDATE/CREATE FUNCTION

## O que precisa acontecer

A migração contém 3 operações que precisam de permissões elevadas:
1. `UPDATE products_cache SET codigo_prefixo = ...` — normalizar prefixos legados
2. `CREATE OR REPLACE FUNCTION set_variantes_por_prefixo()` — nova lógica de agrupamento
3. `UPDATE products_cache SET ativo = true WHERE ...` + `SELECT set_variantes_por_prefixo()` — reativar pais e executar

## Plano: usar o migration tool do Lovable

Em vez de rodar via `psql`, preciso **recriar a migração usando a ferramenta de migração do Lovable** (que tem permissões de superuser). Vou:

1. Deletar o arquivo de migração existente (que nunca foi aplicado)
2. Criar uma nova migração via a ferramenta `supabase migration` com o mesmo SQL
3. A ferramenta aplica automaticamente no banco com as permissões corretas
4. Validar consultando os dados do produto `18645L` para confirmar que `codigo_prefixo` foi normalizado e as variantes foram linkadas

## Validação pós-migração

```sql
SELECT codigo_amigavel, codigo_prefixo, is_variante, produto_pai IS NOT NULL as has_pai, variantes_count
FROM products_cache
WHERE codigo_amigavel LIKE '18645L%'
ORDER BY codigo_amigavel;
```

Resultado esperado: `18645L` como pai com `variantes_count > 1`, e `18645L-AZ1`, `18645L-VDC` etc. com `is_variante = true` e `has_pai = true`.

## Arquivos afetados
- Deletar: `supabase/migrations/20260406203900_fix_variantes_grouping.sql`
- Criar via migration tool: nova migração com o mesmo conteúdo SQL

## Não alterar
- Nenhum código de componente
- Edge function (já deployada)

