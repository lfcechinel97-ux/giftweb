# Deploy da função de criação de usuários + relatório de segurança

## Parte 1 — Deploy (única ação que altera o ambiente)

Publicar `supabase/functions/sistema-criar-usuario` sem tocar no código, com JWT obrigatório
(nenhuma entrada em `supabase/config.toml` marcando `verify_jwt = false` para ela — o padrão já é `true`).
Depois do deploy, testar a URL sem token e confirmar **401** (e não 404).

## Parte 2 — Conferência de segurança (relatório, nada aplicado)

Verificação feita no banco ao vivo (catálogo do Postgres, políticas, privilégios, buckets) + varredura de segurança do Lovable.

### Confirmação do que já foi corrigido hoje
- `vw_pcp`, `vw_fora_de_casa`, `vw_pendentes_compra`: **sem acesso para anon** — confirmado.
- Funções `sistema_mudar_status_producao`, `sistema_next_pedido_numero`, `sistema_next_orcamento_numero`,
  `set_variantes_por_prefixo`, `recalc_estoque_total`, `update_sort_estoque`,
  `get_category_cost_distribution`, `get_category_product_counts`: **sem EXECUTE para anon/public** — confirmado.
- `sistema_calcme_itens`, `sistema_calcme_item_arquivos`, `sistema_calcme_sync_log`,
  `sistema_producao_comentarios`: policies agora exigem `is_admin_user()` — confirmado.
- Policies de storage de `mockups`/`cotacoes`: só `is_admin_user()` — confirmado **nas policies**, mas ver achado C1.

### CRÍTICO

**C1 — Buckets `mockups` e `cotacoes` estão marcados como públicos**
Onde: `storage.buckets` → `mockups public=true`, `cotacoes public=true`.
Impacto: bucket público serve arquivos por URL direta **ignorando as policies**. Comprovantes de
pagamento, notas fiscais, artes e mockups ficam legíveis por qualquer pessoa que tenha/adivinhe a URL.
Correção proposta:
```sql
update storage.buckets set public = false where id in ('mockups','cotacoes');
```
E no app: trocar `getPublicUrl` por `createSignedUrl` (validade curta) nos pontos que exibem
mockups/comprovantes (`src/lib/uploadMockup.ts`, telas de PCP/Financeiro).

**C2 — Tabelas de produção/pedido abertas a QUALQUER conta logada**
Onde: policies `auth_all_*` com `USING (true) / WITH CHECK (true)` para `authenticated` em
`sistema_producao_itens`, `sistema_producao_historico`, `sistema_pedido_itens`,
`sistema_item_historico`, `sistema_cotacoes_frete`, `sistema_fornecedores`, `sistema_tecnicas`.
Impacto: qualquer usuário autenticado (mesmo fora de `admin_users`) lê e altera produção, itens de
pedido, fornecedores e fretes. Também é o achado "error" da varredura do Lovable.
Correção proposta (para cada tabela):
```sql
drop policy "auth_all_sistema_producao_itens" on public.sistema_producao_itens;
create policy "sistema_only" on public.sistema_producao_itens
  for all to authenticated using (is_admin_user()) with check (is_admin_user());
```

### ALTO

**A1 — Views `vw_pcp`, `vw_fora_de_casa`, `vw_pendentes_compra` sem `security_invoker`**
Onde: `pg_class.reloptions` vazio nessas três (as views do financeiro já têm `security_invoker=on`).
Impacto: rodam com os direitos do dono e passam por cima do RLS; hoje qualquer `authenticated`
com SELECT na view vê toda a produção, mesmo sem estar em `admin_users`.
Correção proposta:
```sql
alter view public.vw_pcp set (security_invoker = on);
alter view public.vw_fora_de_casa set (security_invoker = on);
alter view public.vw_pendentes_compra set (security_invoker = on);
revoke all on public.vw_pcp, public.vw_fora_de_casa, public.vw_pendentes_compra from anon;
```

**A2 — Comercial vê tudo no banco; o filtro é só na tela**
Onde: `sistema_pedidos`, `sistema_orcamentos`, `sistema_clientes` → policy `deny_non_admin` com
`is_admin_user()` (que só confere presença em `admin_users`, sem olhar o papel).
Impacto: um vendedor pode consultar pela API todos os pedidos/orçamentos de todos os vendedores.
Correção proposta: policies por papel, ex.:
```sql
create policy "pedidos_por_papel" on public.sistema_pedidos for select to authenticated
using (
  has_role(auth.uid(),'admin') or has_role(auth.uid(),'producao')
  or vendedor_id = (select vendedor_id from public.admin_users where id = auth.uid())
);
```

**A3 — Senha de exclusão de pedido em texto puro e checável por qualquer usuário do sistema**
Onde: `sistema_config.chave='senha_exclusao_pedido'` + `sistema_verificar_senha_exclusao()`
(exige só `is_admin_user()`), e a exclusão em si não exige a senha no banco.
Impacto: vendedor pode testar senhas sem limite, ou simplesmente apagar o pedido direto pela API
sem passar pela tela.
Correção proposta: guardar hash (`crypt`/`pgcrypto`), limitar tentativas, e mover a exclusão para
uma RPC `SECURITY DEFINER` que exige a senha; policy de DELETE em `sistema_pedidos` só para admin.

### MÉDIO

**M1 — Default privileges dão acesso automático ao anon em objetos novos**
Onde: `pg_default_acl` do papel `postgres` no schema `public`: `anon` e `authenticated` recebem
`ALL` em tabelas novas e `EXECUTE` em funções novas.
Impacto: toda tabela criada fora de migration nasce exposta ao anon se esquecerem o RLS.
Correção proposta:
```sql
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke execute on functions from anon, public;
```
(Depois, conceder explicitamente por tabela — as tabelas públicas atuais já têm grants próprios.)

**M2 — Funções SECURITY DEFINER sem checagem no corpo, executáveis por anon**
Onde: `sistema_contar_pedidos_por_coluna` (contagem de pedidos por coluna do PCP),
`sistema_criar_producao_inicial`, `sistema_registrar_mudanca_producao`,
`sistema_registrar_mudanca_status`, `trg_estoque_total*` (essas são de trigger, mas continuam
com EXECUTE para anon).
Impacto: vazamento de volume de pedidos e chamadas diretas de funções internas.
Correção proposta: `revoke execute ... from anon, public` em todas, e acrescentar
`if not is_admin_user() then raise exception 'Not authorized'; end if;` em
`sistema_contar_pedidos_por_coluna`.

**M3 — `products_cache` com policies duplicadas/soltas**
Onde: duas policies de SELECT `true` (`Public read access` e `public_read`) e `admin_write` aplicada
ao papel `public` em vez de `authenticated`.
Impacto: baixo hoje (o UPDATE ainda exige estar em `admin_users`), mas é ruído que esconde erro.
Correção proposta: remover a duplicada e recriar `admin_write` para `authenticated` com `is_admin_user()`.

### BAIXO

- **B1 — `admin_users` / `user_roles`: sem escalada.** `admin_users` só tem SELECT do próprio
  registro; `user_roles` só SELECT (próprio ou admin). Não há INSERT/UPDATE por policy — escrita só
  via RPC (`sistema_salvar_usuario`, `sistema_remover_usuario`), ambas exigindo
  `has_role(auth.uid(),'admin')` e impedindo rebaixar a si mesmo. **Nenhuma correção necessária.**
- **B2 — `sistema_config` com RLS ligado e zero policies:** acesso só por RPC. Correto, apenas registrar.
- **B3 — Leitura pública intencional** em `products_cache`, `site_content`, `catalogo_clientes`,
  `topprodutos_*`, `top10_xbz_ajustes`, `product_collections*`, `spotlight_*`,
  `homepage_featured_showcase`: são dados de vitrine, sem PII. Sem ação.
- **B4 — `leads`:** anon só insere (com validação de e-mail); leitura não é pública. OK.
- **B5 — Varredura do Lovable:** o único achado de nível `error` é exatamente o C2
  (`sistema_producao_itens` com `USING (true)`); o restante são `info` sobre as tabelas de vitrine
  do B3.

## Ordem sugerida de aplicação (após sua aprovação)
1. C1 (buckets privados + URLs assinadas) — maior exposição.
2. C2 e A1 — fechar produção para não-usuários do sistema.
3. A2 e A3 — regra de papel e exclusão de pedido no banco.
4. M1–M3 — endurecimento.

Nada será aplicado sem sua aprovação; nenhum dado será apagado.
