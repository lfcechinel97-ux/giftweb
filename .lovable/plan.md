Vou corrigir os pontos que estão causando o mau funcionamento do `/sistema`, `/sistema/orcamentos` e `/catalogo`.

Plano:

1. Parar a reverificação de acesso a cada troca de página
- Criar/cachear o estado de admin em memória/localStorage com validade curta.
- No `AdminGuard`, usar a sessão local e o cache primeiro, sem chamar o backend toda vez que navegar dentro de `/admin` ou `/sistema`.
- Só revalidar acesso em login, expiração do cache, retry manual ou evento real de logout.
- Evitar `signOut()` automático em erro temporário de rede/backend, para não derrubar o vendedor.

2. Tornar o contexto do sistema mais estável
- Ajustar o `SistemaProvider` para não ficar recarregando todos os cadastros e orçamentos de forma pesada.
- Manter os dados carregados enquanto o usuário navega dentro do sistema.
- Separar o carregamento inicial em partes: cadastros leves primeiro, histórico depois.
- Garantir que o nome do vendedor não suma: se existir vendedor salvo, exibir imediatamente; quando os vendedores carregarem, reconciliar pelo id e manter o nome.

3. Corrigir histórico de orçamentos por vendedor
- Adicionar filtro explícito por vendedor na tela de orçamentos, com padrão no vendedor atual selecionado.
- Mostrar sempre os orçamentos daquele vendedor, sem depender de recarregamentos completos.
- Permitir alternar para “Todos” quando necessário.
- Ao criar orçamento novo, preencher vendedor automaticamente com o vendedor atual e preservar esse vínculo no histórico.

4. Acelerar produtos no `/sistema/orcamentos` e `/sistema/produtos`
- Remover o carregamento de todos os ~10 mil produtos no início do formulário.
- Trocar para busca sob demanda no banco, retornando apenas os primeiros resultados necessários enquanto o vendedor digita.
- Buscar variantes apenas quando um produto for selecionado/expandido.
- Manter cache no React Query para não repetir a mesma busca durante a sessão.
- Para telas que precisam de listagem completa, usar carregamento paginado/limitado em vez de baixar tudo de uma vez.

5. Acelerar o `/catalogo`
- Remover a consulta N+1 das categorias, que hoje faz uma consulta de imagem para cada categoria.
- Criar/usar uma função única no banco para devolver as categorias com imagem de exemplo em uma chamada.
- Trocar a consulta de cores do catálogo para uma função agregada (`distinct`) em vez de baixar todas as cores de todos os produtos.
- Manter paginação de 24 produtos, mas reduzir payload e evitar chamadas redundantes quando filtros mudam rápido.

6. Ajustes no banco para sustentar performance
- Adicionar índices direcionados para os gargalos medidos:
  - produtos ativos ordenados por `codigo_amigavel` para o sistema;
  - cores/catálogo;
  - orçamentos por `vendedor_id` + `created_at`;
  - clientes por nome;
  - lookups por nome.
- Criar funções seguras para:
  - buscar produtos do sistema por termo/página;
  - buscar produto + variantes por prefixo/código;
  - listar cores disponíveis;
  - listar categorias base com imagem.

7. Sobre “armazenar os produtos no cloud”
- Isso já existe: os produtos estão armazenados no banco (`products_cache`) e a API de sincronização atualiza essa lista.
- O problema principal não é falta de armazenamento, é que algumas telas estão baixando produtos demais ou fazendo consultas repetidas.
- Vou manter esse modelo de cache no backend e otimizar a forma como o frontend lê dele.

8. Verificação final
- Testar navegação entre páginas do `/sistema` sem aparecer “Verificando acesso...” repetidamente.
- Testar criação/edição de orçamento com vendedor atual preservado.
- Conferir histórico filtrado por vendedor.
- Conferir carregamento de produtos no formulário e no catálogo.
- Rechecar consultas lentas depois dos ajustes.