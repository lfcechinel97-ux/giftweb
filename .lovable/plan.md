# Corrigir CPF no PDF + orçamentos sumindo

## Diagnóstico (já feito)

1. **Banco vazio**: as tabelas de clientes e orçamentos têm 0 registros. Tudo que você criou até agora ficou apenas na memória do navegador — por isso some ao atualizar a página. As permissões do banco foram corrigidas na última migração, mas as gravações ainda falham quando a sessão de login não está ativa na aba (detectei requisições saindo sem autenticação).
2. **"CPF: —" no PDF**: como o orçamento não tem documento salvo, o PDF usa "CPF" como rótulo padrão. O CNPJ nunca chegou a ser gravado no banco.

## O que será feito

### 1. PDF do orçamento (`src/pages/sistema/pdf.ts`)
- **Nunca mais mostrar "CPF: —"**: se não houver documento cadastrado, a linha some por completo.
- Se o cliente for PJ (ou o documento tiver 14 dígitos), mostra **CNPJ** formatado.
- Se for PF com CPF cadastrado, mostra CPF.
- Se o snapshot do orçamento não tiver documento, busca o cadastro atual do cliente (por id e, como reserva, pelo nome) antes de desistir.

### 2. Parar a perda de dados (`src/contexts/SistemaContext.tsx`)
- **Bloquear gravações sem login**: antes de qualquer salvamento, verificar a sessão. Se expirou, mostrar aviso claro "Sessão expirada — faça login novamente" e redirecionar, em vez de falhar em silêncio.
- Só carregar/salvar dados do sistema quando houver sessão autenticada (hoje o app tenta carregar mesmo deslogado e recebe listas vazias).
- Adicionar aviso de erro em TODAS as gravações que hoje falham caladas (exclusões, clientes, vendedores, etc.).

### 3. Verificação
- Criar cliente PJ de teste com CNPJ e endereço, criar orçamento, atualizar a página e confirmar que os dados permanecem (conferindo direto no banco).
- Gerar o PDF e confirmar que aparece apenas CNPJ + endereço.

## Importante
Os orçamentos e clientes antigos não podem ser recuperados — nunca chegaram a ser gravados. Após a correção, será preciso recadastrar o cliente CURY VENDAS com o CNPJ e refazer o orçamento uma única vez; daí em diante tudo persiste.