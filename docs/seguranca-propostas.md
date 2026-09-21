# Propostas de segurança pendentes (não aplicadas)

Estas três frentes ficaram só no papel, aguardando sua aprovação.

---

## 1. Bucket privado só para comprovantes e notas fiscais

`mockups` e `cotacoes` continuam **públicos** — imagens do PCP, PDFs e a página pública da
terceirizada seguem funcionando exatamente como hoje.

Criar um bucket novo, privado:

```sql
insert into storage.buckets (id, name, public) values ('financeiro-docs','financeiro-docs', false);

create policy "fin_docs_rw" on storage.objects for all to authenticated
  using (bucket_id = 'financeiro-docs' and public.is_admin_user())
  with check (bucket_id = 'financeiro-docs' and public.is_admin_user());
```

No app:
- Upload de comprovante/NF passa a gravar em `financeiro-docs` (telas do Financeiro e
  conferência de venda).
- Exibição/download por `createSignedUrl(path, 300)` em vez de `getPublicUrl`.
- Arquivos antigos de comprovante/NF que estiverem em `mockups` são **copiados** (nunca
  apagados) para o bucket novo, e o registro passa a apontar para o caminho novo.

Risco: só as telas de comprovante/NF mudam. Nenhuma imagem de produto ou mockup é afetada.

---

## 2. A2 — Papel Comercial / Produção valendo no banco

Hoje toda policy do sistema usa `is_admin_user()`, que só confere "está em `admin_users`".
Resultado: um vendedor consegue, pela API, ler pedidos e orçamentos de todos os vendedores —
o filtro por vendedor existe só na tela.

Função auxiliar:

```sql
create or replace function public.meu_vendedor_id()
returns uuid language sql stable security definer set search_path = public as $$
  select vendedor_id from public.admin_users where id = auth.uid()
$$;
```

Pedidos e orçamentos:

```sql
drop policy "deny_non_admin" on public.sistema_pedidos;

create policy "pedidos_leitura" on public.sistema_pedidos for select to authenticated
using (
  public.has_role(auth.uid(),'admin')
  or public.has_role(auth.uid(),'producao')
  or (public.has_role(auth.uid(),'vendedor')
      and vendedor_id is not distinct from public.meu_vendedor_id())
);

create policy "pedidos_escrita" on public.sistema_pedidos for all to authenticated
using (
  public.has_role(auth.uid(),'admin')
  or (public.has_role(auth.uid(),'vendedor')
      and vendedor_id is not distinct from public.meu_vendedor_id())
)
with check (
  public.has_role(auth.uid(),'admin')
  or vendedor_id is not distinct from public.meu_vendedor_id()
);
```
(mesmo par para `sistema_orcamentos`; `sistema_clientes` fica legível para todos os papéis,
já que produção precisa do nome do cliente na ordem de produção.)

### `sistema_producao_itens` (o ponto sensível do PCP)

```sql
drop policy "sistema_only" on public.sistema_producao_itens;

-- Admin e produção enxergam tudo; comercial só a produção dos próprios pedidos.
create policy "producao_leitura" on public.sistema_producao_itens for select to authenticated
using (
  public.has_role(auth.uid(),'admin')
  or public.has_role(auth.uid(),'producao')
  or exists (
    select 1 from public.sistema_pedidos p
    where p.id = pedido_id
      and p.vendedor_id is not distinct from public.meu_vendedor_id()
  )
);

-- Só admin e produção movem cards / mudam status.
create policy "producao_escrita" on public.sistema_producao_itens for all to authenticated
using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'producao'))
with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'producao'));
```

Mesma lógica para `sistema_producao_historico` e `sistema_producao_comentarios`
(leitura acompanha o item; escrita para admin e produção — comercial pode comentar).

### Impacto na tela do PCP

| Papel | O que muda |
|---|---|
| **Admin** | Nada. Vê e move tudo, com valores e custos. |
| **Produção** | Continua vendo **todos** os cards e movendo todas as colunas. Some o valor unitário/total do card e do modal, e os gates de pagamento (Stone/Pix) ficam só de leitura — quem confirma pagamento é admin/comercial. |
| **Comercial** | Passa a ver **apenas** os cards dos próprios pedidos (hoje vê todos). O PCP vira acompanhamento: pode comentar, mas o arrastar-e-soltar fica desabilitado. Os contadores por coluna passam a refletir só a carteira dele. |

Ajustes de código que acompanham: esconder colunas de valor no PCP quando o papel é
`producao`, desabilitar o drag quando é `vendedor`, e `vw_pcp` (já com `security_invoker`)
passa a filtrar sozinha, sem mudança na query.

Ponto a decidir antes de aplicar: **produção deve ver o valor do pedido?** A proposta acima
assume que não.

---

## 3. A3 — Senha de exclusão de pedido

Hoje a senha (`971213`) fica em texto puro em `sistema_config`, a checagem é um `boolean`
que qualquer usuário do sistema pode chamar em loop, e o DELETE em `sistema_pedidos` não
exige senha nenhuma quando feito direto pela API.

Proposta:

1. Guardar hash: `update sistema_config set valor = crypt('971213', gen_salt('bf'))` (extensão
   `pgcrypto`), campo renomeado para `senha_exclusao_hash`.
2. Registrar tentativas em `sistema_auditoria` e bloquear por 15 minutos após 5 erros do
   mesmo usuário.
3. Trocar a exclusão por uma RPC `sistema_excluir_pedido(p_id uuid, p_senha text)`
   `SECURITY DEFINER`, que confere a senha, grava auditoria e só então apaga (cascata do PCP).
4. Remover o DELETE direto: policy de DELETE em `sistema_pedidos` apenas para
   `has_role(auth.uid(),'admin')`.

Assim a senha deixa de ser contornável pela API e a exclusão sempre fica registrada.
