# Diagnóstico do incidente de 07/08/2026 (~07h50) e plano de proteção

## Resposta curta

O incidente **não foi causado pelo plano de performance nem por cache de bundle**. O backend (banco de dados) parou de aceitar conexões. Como o banco é o mesmo para qualquer versão do código, todos os checkpoints antigos apareceram igualmente quebrados — que é exatamente o sintoma que você descreveu no ponto 3.

## A) O que mudou no plano de performance

Arquivos alterados e o que mudou:

- `src/App.tsx` — configuração do cache do React Query (`staleTime` 60s, `gcTime` 30min, sem refetch em foco/montagem, 1 retry, `placeholderData` mantendo o conteúdo anterior); e `lazyRetry`, que reexecuta o import de uma rota que falhou e, em último caso, recarrega a página uma vez.
- `src/contexts/SistemaContext.tsx` — busca de itens em lote em vez de 1 requisição por orçamento; preservação dos itens já carregados quando o evento de auth `SIGNED_IN` dispara um recarregamento.
- `src/pages/sistema/Orcamentos.tsx`, `Pedidos.tsx` — paginação de 10, requisição em lote, `loading="lazy"`/`decoding="async"` nas imagens.
- `src/pages/sistema/SistemaLayout.tsx` — skeleton local na troca de rota e prefetch de chunk/dados no hover do menu.

Respostas ponto a ponto:

2. **Service worker / PWA / cache de assets: não existe nenhum.** Verifiquei o projeto inteiro — nenhuma referência a `serviceWorker`, `workbox` ou `vite-plugin-pwa`, e não há manifest.
3. **Headers HTTP: não foram alterados.** Não existe `_headers`, `_redirects`, `netlify.toml` nem `vercel.json`, e o `vite.config.ts` não define nada de cache. Os headers são os padrão da hospedagem Lovable.
4. **Cache-busting mantido.** O build usa a configuração padrão do Vite, com hash no nome dos arquivos (`PCP-B9X-4vXa.js` etc., visível nos erros que você mandou). Nada foi mudado nisso.
5. **React Query é só memória.** Não há `persistQueryClient`, nem persistência em localStorage/IndexedDB. Ao recarregar a página, o cache some por completo.
6. **A sessão de autenticação não foi tocada.** `src/integrations/supabase/client.ts` é arquivo gerado e continua com `storage: localStorage`, `persistSession`, `autoRefreshToken`. Nenhuma alteração nesse arquivo em todo o plano de performance.
7. **`products_cache` continua sendo consultado pelas mesmas RPCs** (`sistema_search_products`, `search_products_*`). O que mudou foi só a quantidade de linhas por página e o momento das chamadas — não a forma de consultar.

## B) Correlação com o incidente

8. **Horário de deploy:** não tenho acesso ao log de publicações da plataforma, então não posso afirmar o horário exato do último publish. Digo isso explicitamente em vez de supor.
9. **Evidência de cliente:** o único erro recorrente hoje no preview é `Lock "lock:sb-...-auth-token" was released because another request stole it` — contenção do bloqueio de refresh de token entre abas. Isso pode travar temporariamente o login em quem usa várias abas, mas não derruba o site público.
10. **Backend indisponível: confirmado, não descartado.** Na sessão anterior, ao investigar a lentidão, **todas as consultas ao banco falharam por timeout, inclusive um `select 1`** — o banco não estava aceitando novas conexões. O backend foi reiniciado naquele momento e voltou a responder. Agora a leitura de saúde mostra `Restarts (since boot): 0`, ou seja, o relógio de uptime começa naquele reinício, o que bate com a janela do incidente e com a "volta ao normal sozinho".

## C) Hipóteses

11. **Cache de bundle antigo: descartada como causa raiz.** Não há service worker, nem headers customizados, nem persistência de cache de dados, e o cache-busting por hash continua ativo. Um bundle antigo em cache também não explicaria o login parar de funcionar (a autenticação é uma chamada de rede, não código local).
    **Explicação mais provável, com evidência:** saturação/indisponibilidade do banco. O site público renderiza o HTML/CSS estático normalmente (por isso "o visual antigo aparece") mas fica sem produtos e sem banners porque toda consulta falha; e `/sistema` não autentica porque a autenticação depende do mesmo backend. A instância é a menor disponível (**Tiny**) e as telas do sistema abriam muitas consultas pesadas em paralelo.
12. Os checkpoints antigos apareciam quebrados **pelo mesmo motivo**: preview de qualquer versão aponta para o mesmo banco. Versão de código não muda nada quando o banco está fora.

## Plano proposto

### Etapa 1 — Causa raiz: capacidade do backend
- Aumentar o tamanho da instância do Lovable Cloud (hoje Tiny). Isso é feito por aqui, com uma tela de aprovação sua; leva alguns minutos e afeta o consumo do plano.
- Com o banco estável, rodar a análise de consultas lentas e `EXPLAIN` nas RPCs mais usadas (`sistema_list_orcamentos`, `sistema_get_bootstrap`, `sistema_search_products`, view `vw_pcp`) e criar os índices que faltarem.
- Reduzir o número de consultas simultâneas no carregamento inicial do `/sistema` (hoje bootstrap + clientes + orçamentos + pedidos + ajustes disparam juntos).

### Etapa 2 — Nunca mais tela quebrada silenciosa
- **Error boundary global** com mensagem clara ("Não foi possível carregar os dados") e dois botões: "Tentar de novo" e "Recarregar limpando cache" (recarga forçada + limpeza de caches do navegador). Substitui qualquer página em branco.
- **Detector de backend fora do ar:** um aviso fixo no topo quando as consultas falham por rede/timeout, com botão de nova tentativa — em vez do "Carregando…" eterno de hoje.
- **Timeout + 1 nova tentativa** nas consultas do sistema, para diferenciar "demorou" de "caiu".

### Etapa 3 — Garantias de cache (preventivo, mesmo não sendo a causa)
- Confirmar por escrito no build que o hash de arquivo continua ativo e adicionar um carimbo de versão do build exposto no app.
- **Verificação de versão:** se o app detectar que o `index.html` do servidor aponta para uma versão de build diferente da carregada, mostra um aviso discreto "Nova versão disponível — recarregar", e força a recarga se um chunk falhar (o `lazyRetry` já cobre parte disso).
- Não introduzir service worker nem PWA — a ausência deles é justamente o que evita esse tipo de travamento.

### Etapa 4 — Corrigir o erro de bloqueio de sessão entre abas
- Ajustar o tratamento do refresh de token para não derrubar a sessão quando o bloqueio é roubado por outra aba (sintoma de "login não funciona" em quem trabalha com várias abas abertas).

### 16) Como testar antes de publicar
1. Na prévia, com **cache limpo** (janela anônima): navegar site público, `/catalogo`, `/sistema/orcamentos`, `/sistema/pedidos`, `/sistema/pcp`, login.
2. Com **cache sujo**: abrir a prévia antes da alteração, deixar a aba aberta, aplicar as mudanças e voltar à mesma aba sem recarregar — confirmar que aparece o aviso de nova versão em vez de tela quebrada.
3. **Simular backend fora**: bloquear as chamadas do backend nas ferramentas do navegador e confirmar que aparece o aviso de erro com botão de recarregar, não uma tela em branco nem "Carregando…" infinito.
4. Repetir o teste 3 em duas abas simultâneas para validar a correção de sessão.

### 17) Rollback
- Caminho mais rápido: **History no editor** → restaurar o checkpoint imediatamente anterior → publicar. Leva menos de um minuto e não afeta o banco.
- As mudanças desta etapa são todas de frontend, exceto os índices (que são aditivos e podem ser removidos isoladamente) e o redimensionamento da instância (reversível pela mesma tela).
- Se o sintoma voltar a ser "visual carrega mas sem dados + login falha", o rollback de código **não** vai resolver — é sinal de backend; o caminho é checar a saúde do banco e reiniciar.

## Detalhes técnicos
- Novos arquivos: error boundary global e um hook de verificação de versão de build.
- Alterados: `src/App.tsx` (boundary + verificação de versão), `src/contexts/SistemaContext.tsx` (timeout/retry e estado de erro), `src/integrations/supabase/client.ts` **não será alterado** (arquivo gerado); o ajuste de sessão entre abas fica em um wrapper.
- Banco: apenas `CREATE INDEX` aditivos, após a análise de consultas lentas.
