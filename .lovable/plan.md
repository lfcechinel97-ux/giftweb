## Diagnóstico

Verifiquei o banco e encontrei a causa raiz de tudo (CPF no PDF + cadastros que somem):

- As 8 tabelas do sistema (`sistema_clientes`, `sistema_orcamentos`, `sistema_pedidos`, `sistema_vendedores`, `sistema_meios_pagamento`, `sistema_transportadoras`, `sistema_origens`, `sistema_ajustes_estoque`) têm políticas de acesso corretas (admin), **mas nenhuma permissão de acesso à API para usuários logados**. Isso provavelmente foi efeito colateral da correção de segurança anterior.
- Consequência: **todo salvamento falha** com erro de permissão. Cliente, vendedor, meio de pagamento e orçamento nunca chegam ao banco — por isso somem ao recarregar a página.
- O PDF mostra "CPF: —" porque o cadastro do cliente (com CNPJ e endereço) nunca foi salvo; na hora de gerar o PDF não há documento nenhum, e sem documento o sistema não consegue identificar que é CNPJ.

A lógica do PDF (CNPJ vs CPF, endereço, IE, snapshot) já está correta — ela só não tem dados para mostrar.

## O que vou fazer

### 1. Restaurar as permissões das tabelas do sistema (migração)
Conceder acesso de leitura/escrita para usuários autenticados (as políticas de admin continuam controlando quem pode de fato acessar) e acesso total para o serviço interno, nas 8 tabelas `sistema_*`.

### 2. Verificar
Após a migração, testar um insert como usuário autenticado e confirmar que os dados persistem.

## Resultado esperado
- Clientes, vendedores, meios de pagamento e orçamentos passam a ser salvos de verdade.
- Ao recadastrar o cliente CURY VENDAS com o CNPJ, o PDF mostrará "CNPJ: XX.XXX.XXX/XXXX-XX" com endereço e IE.
- Os cadastros antigos não podem ser recuperados (nunca foram gravados) — será preciso recadastrar.

## Detalhes técnicos
```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sistema_clientes, public.sistema_orcamentos, public.sistema_pedidos, public.sistema_vendedores, public.sistema_meios_pagamento, public.sistema_transportadoras, public.sistema_origens, public.sistema_ajustes_estoque TO authenticated;
GRANT ALL ON (mesmas tabelas) TO service_role;
```
Nenhuma alteração de código é necessária — apenas a migração.