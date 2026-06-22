## Diagnóstico

Os dois problemas têm a **mesma causa raiz**: o backend (Lovable Cloud) está sobrecarregado.

**Evidências:**
- Várias requisições para `products_cache` e `site_content` retornando **503 PGRST002** ("Could not query the database for the schema cache")
- Logs de auth mostrando timeouts conectando ao Postgres (`dial tcp [::1]:5432: i/o timeout`) — é por isso que `/admin` não loga: o GoTrue não consegue validar a sessão
- `db_health` deu timeout
- `slow_queries` mostra queries em `products_cache` levando **1,3s–5,3s em média**, executadas dezenas de vezes (uma única consulta acumulou **33s** de tempo total)

O `/catalogo` é a página que mais castiga o banco (várias chamadas paralelas a `products_cache` com filtros pesados em `categoria`, `ativo`, `has_image`, `is_hidden`, `estoque`). Isso satura a CPU/conexões e respinga no login do admin.

## Plano de correção

### 1. Recuperação imediata (destrava `/admin` agora)
- Rodar `supabase--restart` na Lovable Cloud para limpar conexões travadas e o schema cache do PostgREST.
- Conferir `cloud_status` até voltar `ACTIVE_HEALTHY`.

### 2. Índices no `products_cache` (corrige a lentidão do `/catalogo`)
A tabela é consultada com combinações de `ativo + has_image + is_variante + is_hidden + estoque + categoria` ordenando por `estoque` ou `updated_at`. Sem índice composto, o Postgres faz scan da tabela toda a cada request. Criar via migration:

```sql
-- Lista por categoria (caso mais frequente)
CREATE INDEX IF NOT EXISTS idx_pc_categoria_estoque
  ON public.products_cache (categoria, estoque DESC)
  WHERE ativo = true AND has_image = true AND is_variante = false;

-- Listagem global ordenada por updated_at
CREATE INDEX IF NOT EXISTS idx_pc_updated_at
  ON public.products_cache (updated_at DESC)
  WHERE ativo = true AND has_image = true AND is_variante = false;

-- Busca por categoria_manual (ilike em listagem de imagens)
CREATE INDEX IF NOT EXISTS idx_pc_categoria_manual_trgm
  ON public.products_cache USING gin (categoria_manual gin_trgm_ops);

-- Filtro por preço
CREATE INDEX IF NOT EXISTS idx_pc_preco_custo
  ON public.products_cache (preco_custo)
  WHERE ativo = true AND has_image = true;
```

Confirmar com `EXPLAIN ANALYZE` que o planner está usando os novos índices.

### 3. `AdminGuard` mais resiliente
O `AdminGuard.tsx` hoje chama `supabase.auth.getUser()` direto no mount. Quando o backend está lento ou o token está sendo validado, ele falha e redireciona pro `/admin/login` mesmo com sessão válida. Mudanças:
- Usar `getSession()` (lê do storage local sem chamar a rede) + listener `onAuthStateChange` antes de qualquer query.
- Tratar erro de rede da consulta a `admin_users` separadamente do "não é admin" (não deslogar em erro transitório, mostrar mensagem com botão "tentar novamente").
- Mesmo tratamento no `AdminLogin.tsx`.

### 4. Reduzir carga do `/catalogo`
- Garantir que as chamadas só carreguem as colunas necessárias (já fazem `select` específico, ok).
- Adicionar `staleTime` no react-query da home (`useHomepageData`) caso ainda não tenha, pra evitar refetch agressivo.
- Avaliar mover a busca de cores (`select cor from products_cache ...` sem limite) para um RPC com `DISTINCT` no servidor — hoje traz todas as linhas pro cliente.

### 5. Se persistir → upgrade de instância
Mesmo com índices, se o tráfego real estiver acima do que a instância atual aguenta, o caminho é **Backend → Advanced settings → Upgrade instance** na Lovable Cloud. Eu aviso depois das otimizações se ainda houver sinais de saturação.

## Resumo técnico
- Restart do backend
- Migration com 4 índices parciais em `products_cache`
- Refator do `AdminGuard` (session-first + retry em erro de rede)
- Pequenos ajustes de cache no fetch da home
- Recomendação de upgrade de instância como plano B
