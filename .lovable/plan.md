Vou corrigir o funcionamento do `/sistema` com foco no problema urgente mostrado no print: vendedor aparecendo como vazio por vários segundos e orçamentos sumindo após atualizar a página.

Plano de execução:

1. Corrigir o carregamento inicial do sistema
- Criar uma inicialização explícita de autenticação no `SistemaProvider` para só consultar dados depois que a sessão do usuário estiver realmente restaurada.
- Evitar que a tela mostre “0 orçamentos” e “Nenhum cadastrado” enquanto ainda está carregando; exibir estado de carregamento real.
- Preservar o vendedor salvo no navegador imediatamente no topo, mesmo antes da lista completa de vendedores terminar de carregar.

2. Resolver o sumiço dos orçamentos após refresh
- Fazer o salvamento de orçamento aguardar confirmação do backend antes de navegar de volta para a listagem.
- Se o backend rejeitar ou der timeout, manter o orçamento na tela e mostrar erro claro, sem fingir que salvou.
- Depois de salvar, recarregar/confirmar o orçamento gravado para garantir que ele continue aparecendo após atualizar a página.

3. Fazer o histórico de orçamentos sempre aparecer
- Mudar a listagem de orçamentos para buscar os dados com uma função otimizada do backend, sem depender do carregamento pesado de todo o contexto.
- Carregar os últimos orçamentos rapidamente, ordenados por data.
- Manter filtro por vendedor, mas sem esconder tudo enquanto o vendedor ainda não terminou de carregar.
- Permitir ver “Todos os vendedores” e também filtrar automaticamente pelo vendedor atual quando ele estiver definido.

4. Corrigir o gargalo que está causando timeout
- Adicionar uma função otimizada para listar orçamentos já com dados mínimos necessários para a tela.
- Adicionar uma função otimizada para listar dados-base do sistema em uma única chamada leve: vendedores, pagamentos, transportadoras e origens.
- Reduzir chamadas simultâneas pesadas no `SistemaProvider`, principalmente clientes/orçamentos/pedidos/estoque carregados todos juntos.

5. Melhorar a seleção do vendedor
- Se só existir um vendedor ativo, selecionar automaticamente esse vendedor.
- Se o vendedor salvo existir no banco, atualizar o nome dele ao carregar.
- Se o vendedor salvo não existir mais, limpar a seleção e mostrar a necessidade de selecionar outro.

6. Garantir segurança e acesso
- Manter os dados do sistema protegidos por autenticação/admin.
- Não abrir os orçamentos publicamente.
- Ajustar funções do backend para respeitarem o mesmo controle de acesso já usado no admin.

7. Verificação final
- Conferir no banco que os orçamentos existem e que os vendedores existem.
- Validar o fluxo: abrir `/sistema/orcamentos`, selecionar vendedor, criar orçamento, voltar para listagem, atualizar a página e confirmar que o orçamento continua visível.

Detalhes técnicos:
- A investigação já confirmou que os orçamentos estão gravados no backend: existem 70 orçamentos e 3 vendedores.
- O problema visível agora não é ausência de dados; é carregamento instável/timeout na consulta do sistema.
- A requisição de `sistema_orcamentos` chegou a retornar timeout (`canceling statement due to statement timeout`), por isso a tela cai em estado vazio.
- Vou trocar o padrão atual de carregar tudo em paralelo por chamadas menores e mais previsíveis, com retry/erro visível e sem sobrescrever a UI com listas vazias durante falha temporária.