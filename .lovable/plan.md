# Deploy + endurecimento de segurança (escopo aprovado)

## 1. Deploy
Publicar `supabase/functions/sistema-criar-usuario` sem alterar o código, com JWT obrigatório.
Depois, chamar a URL sem token e confirmar **401** (não 404).

## 2. C2 — Fechar tabelas abertas a qualquer conta logada
Trocar as policies `auth_all_*` (`USING (true)` / `WITH CHECK (true)`) por `is_admin_user()` em:
`sistema_producao_itens`, `sistema_producao_historico`, `sistema_pedido_itens`,
`sistema_item_historico`, `sistema_cotacoes_frete`, `sistema_fornecedores`, `sistema_tecnicas`.
```sql
drop policy "auth_all_<tabela>" on public.<tabela>;
create policy "sistema_only" on public.<tabela>
  for all to authenticated using (is_admin_user()) with check (is_admin_user());
```

## 3. A1 — Views com `security_invoker` (aplicado depois do C2)
```sql
alter view public.vw_pcp             set (security_invoker = on);
alter view public.vw_fora_de_casa    set (security_invoker = on);
alter view public.vw_pendentes_compra set (security_invoker = on);
```
Conferir em seguida que o PCP continua carregando para um usuário de `admin_users`.

## 4. M1 — Default privileges
```sql
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke execute on functions from anon, public;
```
Não altera nenhuma tabela existente — só impede que objetos novos nasçam expostos.

## 5. M2 — Funções SECURITY DEFINER
Revogar EXECUTE de `anon`/`public` em `sistema_contar_pedidos_por_coluna`,
`sistema_criar_producao_inicial`, `sistema_registrar_mudanca_producao`,
`sistema_registrar_mudanca_status`, `trg_estoque_total`, `trg_estoque_total_after`,
e adicionar `if not public.is_admin_user() then raise exception 'Not authorized'; end if;`
no corpo de `sistema_contar_pedidos_por_coluna`.
(Funções de trigger continuam funcionando — o trigger roda como dono da tabela.)

## 6. M3 — Limpeza em `products_cache`
Remover a policy de SELECT duplicada e recriar `admin_write` para o papel `authenticated`
usando `is_admin_user()`. A leitura pública do catálogo permanece.

## 7. Validação
- Função responde 401 sem token.
- PCP, Pedidos, Orçamentos e Financeiro abrem normalmente com conta do sistema.
- Site público (catálogo, produtos, imagens) sem alteração.

## 8. Entregas apenas como proposta (sem aplicar)

**Bucket privado só para comprovantes e notas fiscais**
Criar `financeiro-docs` privado; `mockups`/`cotacoes` seguem públicos (imagens, PDFs e a página
da terceirizada continuam funcionando). Policies de `storage.objects` restritas a `is_admin_user()`,
upload e leitura via URL assinada de curta duração no app. Migrar apenas comprovantes/NF já
existentes (cópia, sem apagar nada) e apontar as telas do Financeiro para o bucket novo.

**A2 — Papel Comercial/Produção no banco**
Policies por papel em `sistema_pedidos`, `sistema_orcamentos`, `sistema_clientes` e
`sistema_producao_itens`: admin vê tudo; produção vê tudo de produção mas não valores/custos;
comercial só as próprias vendas (`vendedor_id = admin_users.vendedor_id`). Inclui o impacto no
PCP para o papel produção (quais colunas e campos deixam de aparecer) e os ajustes de RPC.

**A3 — Senha de exclusão de pedido**
Guardar hash com `pgcrypto`, limitar tentativas, mover a exclusão para RPC que exige a senha e
restringir o DELETE em `sistema_pedidos` ao papel admin.

Nada será apagado em nenhuma etapa.
