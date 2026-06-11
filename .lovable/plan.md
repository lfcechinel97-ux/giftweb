## Diagnóstico

Pela imagem o PDF mostra "CPF: —" para a EASY IMPORTS (que é PJ). Combinando isso com o sintoma anterior ("toda vez que cadastro vendedor / cliente / etc, depois some"), o problema é o mesmo:

1. **O banco está vazio.** Consultei `sistema_clientes` e `sistema_orcamentos` e ambos têm 0 registros, embora você esteja cadastrando clientes e gerando orçamentos. Significa que os `insert` no Supabase estão falhando silenciosamente (os `.then()` ignoram erros). Sem `cliente` no banco, ao recarregar a página o contexto carrega lista vazia.
2. **O PDF depende da busca do cliente em memória.** Quando o cliente não é encontrado, o PDF mostra `CPF: —` e sem endereço, mesmo que o cadastro original tivesse CNPJ e endereço completos. Foi isso que aconteceu no orçamento da EASY IMPORTS.

## O que vou fazer

### 1. Gravar um "snapshot" do cliente no próprio orçamento
Adicionar a coluna `cliente_snapshot` (JSONB) em `sistema_orcamentos`, contendo no momento do save:
- `nome`, `tipo` (PJ/PF), `documento`, `ie`
- `endereco` (logradouro, número, complemento, bairro, cidade, UF, CEP)
- `contato` (nome, telefone, e-mail)

O PDF passa a ler primeiro do snapshot e só usa a busca em memória como fallback. Vantagem: o orçamento mantém os dados corretos para sempre, mesmo se o cadastro do cliente for editado, removido ou ainda não tiver sincronizado.

### 2. Corrigir o rótulo CNPJ/CPF e exibir endereço completo
- Rótulo escolhido só por `tipo` ou pelo nº de dígitos do documento (14 = CNPJ).
- Bloco do cliente no PDF mostra: CNPJ/CPF formatado, IE (quando PJ), endereço em até 2 linhas com CEP, e contato.
- Quando o documento estiver realmente em branco, o rótulo continua sendo o correto (CNPJ para PJ) e o valor fica vazio em vez de "—".

### 3. Surface dos erros de gravação
- Adicionar `console.error` + `toast.error("Não foi possível salvar no banco…")` em `addCliente`, `updateCliente`, `addVendedor`, `addMeioPagamento`, `addTransportadora`, `addOrigem`, `addOrcamento`, `updateOrcamento`, `aprovarOrcamento`.
- Isso torna visível qualquer falha de RLS/permissão (é o motivo de "sumir" os cadastros).
- Depois que você reproduzir e me mandar a mensagem do toast, eu corrijo a causa raiz (provavelmente quem está logado não está em `admin_users`, ou a sessão Supabase não está chegando até o cliente no momento do `insert`).

### Arquivos afetados
- Migração nova: `ALTER TABLE sistema_orcamentos ADD COLUMN cliente_snapshot JSONB`.
- `src/contexts/SistemaContext.tsx` — escrever/ler `cliente_snapshot`, surface de erros.
- `src/pages/sistema/OrcamentoForm.tsx` — montar e enviar o snapshot ao salvar.
- `src/pages/sistema/pdf.ts` — usar o snapshot como fonte primária.

### Fora do escopo deste passo
- Re-popular orçamentos antigos com snapshot (não há como recuperar dados que nunca foram salvos no banco). Orçamentos novos passam a sair corretos.
