# Diagnóstico do banco e plano de estabilidade — sem redimensionamento

## Conclusão

O banco voltou a responder após o reinício solicitado. **Não foi alterado o tamanho da instância**: a tentativa anterior de abrir o redimensionamento foi cancelada antes de executar.

Há **gargalos concretos de otimização**, além de pouca margem estrutural de uma Tiny para um ERP/CRM em produção. Não há evidência suficiente para atribuir a queda exclusivamente à falta de CPU/RAM. A recomendação é corrigir os gargalos medidos, acompanhar a carga real e só então decidir sobre capacidade. Mini continua sendo uma opção prudente para produção, não uma correção comprovada da causa da queda.

Diagnóstico orientado pela skill **database-pressure**.

## 1. Estado atual e limites da medição

Leituras ao vivo feitas nesta análise, aproximadamente 17:34–17:36 UTC de 10/11/2026:

| Indicador | Evidência |
|---|---|
| Instância | **Tiny**, CPU compartilhada e até **0,5 GB RAM** |
| Banco e pool de conexões | Ambos funcionando |
| RAM atual | **57%** |
| Maior RAM observada nas amostras desta sessão | **57%**; após reiniciar havia 53%. Não é o pico histórico |
| CPU atual e pico histórico | **Indisponíveis nos instrumentos acessíveis**; não seria correto inventar percentuais |
| Pico histórico de RAM | Não disponível; não há série histórica de RAM acessível nesta análise |
| Conexões ao banco | **30/60**, 50% do limite; antes havia 10/60 |
| Clientes no pool | **1/200** |
| Disco de dados ocupado | **12%** — não está cheio |
| Banco | **649,5 MB** |
| WAL, registro de alterações | **128 MB** |
| Transações desfeitas desde inicialização | 1; isoladamente não indica problema |

30 conexões **não equivalem a 30 usuários ou 30 consultas executando**: incluem conexões de serviços e conexões ociosas.

Último alerta disponível: **DiskIO em 10/11 às 00:59:55 UTC**, valor 14, classificado como orçamento de I/O abaixo de 50%. Isso significa pressão de leitura/escrita, não disco cheio. É um alerta histórico; **não mede I/O atual nem prova a causa da indisponibilidade das 17h**. CPU e I/O atuais permanecem não verificados. A busca de logs de erros não retornou registros capazes de explicar a queda.

## 2. Consultas SQL mais lentas

Tempos registrados no `pg_stat_statements`, não latência completa do navegador. Parâmetros reais foram normalizados pelo banco; os exemplos abaixo representam o formato das consultas, não os valores originais de cada requisição.

| Consulta | Chamadas | Média | Máximo | Total |
|---|---:|---:|---:|---:|
| Contagem de produtos com `nome ILIKE ... OR descricao ILIKE ...` e filtros do catálogo | 3 | 1.652 ms | 2.236 ms | 4.957 ms |
| Maior `preco_base`, ordenado decrescente, produtos ativos/com imagem | 2 | 1.683 ms | 2.299 ms | 3.366 ms |
| Outra entrada normalizada da mesma busca de maior preço | 1 | 2.011 ms | 2.011 ms | 2.011 ms |
| Categorias dos produtos filtrados | 3 | 599 ms | 935 ms | 1.796 ms |
| Outra entrada da contagem com busca textual | 1 | 1.546 ms | 1.546 ms | 1.546 ms |
| `vw_pcp`, quadro ordenado por prazo, excluindo enviados antigos | 9 | 144 ms | 199 ms | 1.294 ms |
| `get_catalog_story_categories()` | 2 | 399 ms | 656 ms | 797 ms |
| Clientes, todas as colunas, ordenados por nome | 2 | 299 ms | 416 ms | 598 ms |

A primeira leitura imediatamente após o reinício tinha poucas chamadas; agora já há evidência do catálogo. Ainda não é uma janela representativa de todo o expediente ou de uma sincronização completa.

### Planos de execução conferidos

**Maior preço:**
```sql
SELECT preco_base FROM public.products_cache
WHERE (is_hidden IS NULL OR is_hidden=false)
  AND ativo=true AND has_image=true AND preco_base>0
ORDER BY preco_base DESC LIMIT 1;
```
`EXPLAIN (ANALYZE, BUFFERS)` mediu **2.195 ms**. Usou `idx_ativo`, percorreu **11.278 linhas elegíveis**, descartou 698 e ordenou para devolver apenas uma. Foram cerca de **4.801 blocos encontrados em cache e zero blocos lidos do disco** nessa execução. Portanto, esse teste não permite culpar leitura física de disco; comprova trabalho evitável e tempo elevado mesmo com cache aquecido.

**Contagem textual com exemplo `%copo%`:** mediu **34 ms** em nova execução, usando índice parcial de estoque/categoria, mas filtrando texto em 2.808 candidatos e acessando 2.102 blocos da tabela. O plano não usa índice textual para `nome/descricao`. A diferença frente aos registros de 1,5–2,2 s demonstra variação por parâmetros, cache, concorrência e contexto; não autoriza afirmar que toda busca demora 2 s.

## 3. Gargalos confirmados e oportunidades

### A. Orçamentos muito volumosos — prioridade alta

- `sistema_orcamentos` ocupa **551.059.456 bytes (~525,5 MiB)**, aproximadamente 81% do tamanho reportado do banco, com unidades convertidas.
- Existem **733 orçamentos**.
- O campo `itens` tem média armazenada de **662.908 bytes (~647 KiB)** e máximo de **26.010.877 bytes (~24,8 MiB)**. Tamanho armazenado pode diferir do JSON enviado pela rede.
- No maior registro, apenas **7 itens**; confirmei presença de **imagem base64 dentro do JSON**.
- O código atual do formulário já encaminha novos mockups ao Storage e guarda URL. Isso não limpa automaticamente dados antigos.

**Proposta:** impedir reintrodução de imagens embutidas; carregar resumo na lista e itens somente quando necessários; depois migrar imagens antigas em lotes pequenos, preservando cada imagem e validando a URL antes de substituir o conteúdo. Não apagar orçamento, anexo ou arquivo. Exportar previamente pelo fluxo oficial do Lovable Cloud; o export do banco não inclui arquivos do Storage.

Esse volume aumenta leituras, serialização, transferências e regravação/WAL. É um candidato relevante à pressão, mas não há correlação temporal suficiente para apontá-lo como causa única da queda.

### B. Maior preço sem índice correspondente — prioridade alta

Existem diversos índices em `products_cache`, inclusive `preco_custo`, mas **não há índice de `preco_base` correspondente a essa ordenação/filtro**.

**Proposta técnica:** índice parcial em `preco_base DESC` com exatamente os predicados de visibilidade, ativo, imagem e preço positivo. Revalidar o plano antes/depois. Compartilhar cache do maior preço, pois `useMaxPrice` hoje consulta a cada montagem, sem cache TanStack Query próprio.

Trade-off: pequeno espaço adicional e manutenção a cada alteração de preço; evitar índices redundantes ou genéricos.

### C. Busca textual e contagens do catálogo — prioridade alta

Os índices trigram e texto existentes indexam **`busca`**, enquanto as consultas lentas usam **`nome` e `descricao`**. A página inicial também baixa categorias de produtos e agrega no navegador, além de fazer contagem textual exata separada.

**Proposta:** validar equivalência da pesquisa antes de aproveitar `busca`; preservar correspondências e filtros atuais. Se não for equivalente, medir índices específicos em nome/descrição versus seu custo de escrita, em vez de criar ambos indiscriminadamente. Consolidar contagens por categoria em uma consulta agregada e cache compartilhado. Não substituir números exatos por estimativas sem aprovação.

### D. RLS: redundância confirmada, impacto ainda a medir

RLS está habilitado nas tabelas principais; `vw_pcp` usa `security_invoker=on`. **Não desabilitar RLS nem abrir o ERP ao público.**

- Clientes, pedidos e orçamentos têm uma policy com `(SELECT is_admin_user())` e outra com chamada direta `is_admin_user()` para operações sobrepostas.
- Produção tem duas policies internas com a mesma chamada direta, além da policy da terceirizada.
- `is_admin_user` é STABLE/SECURITY DEFINER e consulta `admin_users` pela chave primária. **Não significa necessariamente “só papel admin”**: verifica cadastro na equipe interna.
- No Kanban, helpers consultam acesso ao quadro/cartão por linha; índices das chaves e vínculos já existem.

**Proposta:** medir planos autenticados por papel; consolidar policies equivalentes e transformar verificações independentes da linha em subconsulta escalar, mantendo exatamente os acessos atuais. Não aplicar essa transformação a funções dependentes de `card_id/board_id`. Testar admin, gerente, vendas, produção e terceirizada antes de publicar.

O plano público do catálogo não prova o custo do ERP autenticado. RLS é oportunidade de otimização, **não causa comprovada da queda**.

### E. PCP, Kanban e tarefas agendadas — prioridade média

- PCP já tem cache e quadro revalidado a cada **2 minutos**, com enviados antigos cortados em 14 dias; resumo de chat e menções continuam a cada **30 segundos**.
- Kanban já usa cache e atualizações por eventos com agrupamento de 500 ms. Não encontrei motivo para reescrever esse mecanismo por padrão.
- Há sincronização de produtos 4 vezes/dia (**11,15,19,23 UTC**) e outro job às **08 UTC**, mais lembretes do Kanban a cada minuto.
- O registro de cron confirma o disparo, **não o sucesso ou duração completa das funções assíncronas**. Os lembretes observados executaram a chamada SQL em dezenas de milissegundos.

**Proposta:** medir a execução completa das sincronizações, impedir sobreposição e agrupar atualizações repetidas. Não reduzir frequência de estoque ou atrasar notificações sem aprovação. Nenhum dos horários de sync listados coincide diretamente com o alerta das 00:59 UTC, portanto não há causalidade confirmada.

## 4. Capacidade ou otimização?

**Otimização comprovadamente necessária:** orçamento volumoso, maior preço sem índice adequado e pesquisa usando colunas diferentes das indexadas.

**Capacidade atual:** RAM e conexões não estão saturadas nas amostras; disco está longe de cheio. Tiny tem pouca folga para catálogo público + ERP/CRM simultâneos, mas não disponho de CPU/picos históricos para provar insuficiência computacional como causa da queda.

**Recomendação:** executar primeiro as otimizações de baixo risco e monitorar em horário de maior uso e durante sync. Se houver nova indisponibilidade, RAM persistente acima de ~80%, fila/saturação de conexões, erros de falta de memória ou alertas de CPU/I/O apesar dos ajustes, recomendar Mini com nova aprovação. Por ser produção em Tiny e já haver alerta, Mini é recomendável como margem operacional, mas fica explicitamente adiada conforme seu pedido.

## 5. Custos — sem executar mudança

| Opção | RAM | Referência de créditos/hora ativa | 720 horas ativas |
|---|---:|---:|---:|
| Manter Tiny | Até 0,5 GB | 0,08 | 57,6 |
| Mini, se aprovada posteriormente | 1 GB | 0,10 | 72,0 |
| Diferença | Aproximadamente dobro da RAM nominal | **+0,02/h (+25%)** | **+14,4 créditos** |

São referências padrão, **não cotação do seu workspace**, antes de franquias/descontos. A consulta de cobrança real mostrou gasto agregado de compute “pico” de 176,063 créditos no período amplo retornado, sem horas ativas ou tarifa unitária; por isso não é possível derivar seu preço efetivo. Aumento de instância cobra mais por toda hora ativa, não por usuário ou consulta, e não resolve consultas mal desenhadas. Otimizações também têm custo de implementação e índices têm custo de escrita/armazenamento.

## 6. Plano proposto para aprovação

**Decisão do usuário: somente acompanhar a estabilidade.** As otimizações descritas acima ficam como recomendações, não serão executadas.

1. Fazer acompanhamento somente de leitura durante a sessão: disponibilidade, RAM, conexões, disco e consultas lentas.
2. Comparar as amostras sem confundir alertas históricos com pressão atual. Na amostra mais recente, banco e pool estão funcionando, RAM **59%**, conexões **17/60**, clientes do pool **1/200** e disco **12%**.
3. Investigar em leitura o contador de transações desfeitas: passou de **1 para 1.963** entre amostras. A busca recente nos logs não retornou erros que expliquem o aumento; não atribuir causa sem evidência. Isso merece atenção mesmo sem saturação de RAM/conexões.
4. Se o site ficar sem dados novamente ou surgir novo alerta, conferir disponibilidade e métricas naquele momento e apresentar o resultado antes de qualquer intervenção.
5. Não alterar instância, índices, RLS, dados, frequências de atualização ou tarefas agendadas. Não instalar monitoramento nem criar jobs.

**Limite do acompanhamento:** as verificações são pontuais enquanto esta sessão executa; não há acompanhamento contínuo por este assistente após o fim da resposta. Para uma nova conferência, enviar uma mensagem, preferencialmente no momento da lentidão ou do alerta.

Não executar VACUUM pesado, limpeza em massa, mudanças de cron, alteração de permissões de negócio ou redimensionamento nesta etapa sem aprovação específica. Estatísticas parciais pós-reinício, como contagens zeradas de tabelas que contêm dados, não são evidência de tabela vazia ou ausência de manutenção.
