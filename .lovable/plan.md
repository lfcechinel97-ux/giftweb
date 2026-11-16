# Aplicar duas migrations do repositório

1. Aplicar `supabase/migrations/20261116130000_usuario_varios_vendedores.sql` byte a byte, sem alterações.
2. Aplicar `supabase/migrations/20261116150000_orcamento_prazo_entrega_faixa.sql` byte a byte, sem alterações.
3. Nenhum arquivo do front-end será tocado.
4. Conferir no banco:
   - coluna `admin_users.vendedores_extras`
   - função `public.sistema_salvar_usuario` com parâmetro `p_vendedores_extras`
   - função `public.sistema_meus_vendedores()`
   - coluna `sistema_orcamentos.prazo_entrega_ate`
5. Se alguma migration falhar, nada é aplicado dela; relato o erro sem editar o arquivo.
