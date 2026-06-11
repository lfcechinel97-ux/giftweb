# Sistema de Orçamentos: salvar tudo no banco de dados (compartilhado entre vendedores)

## Por que os dados somem

Todo o Sistema do Vendedor (`/sistema`) hoje salva os dados **apenas no navegador** (localStorage). Isso explica os dois problemas:

- **Cada vendedor só vê os próprios orçamentos**: os dados ficam presos no navegador/computador de quem criou. Nenhum dado é enviado ao servidor.
- **Cadastros somem**: ao limpar o cache do navegador, usar aba anônima, trocar de computador ou celular, tudo desaparece — vendedores, meios de pagamento, transportadoras, clientes, orçamentos e pedidos.

A solução é migrar todos esses dados para o banco de dados na nuvem (Lovable Cloud), assim ficam permanentes e visíveis para todos.

## O que será feito

### 1. Criar tabelas no banco de dados
- `sistema_vendedores`, `sistema_meios_pagamento`, `sistema_transportadoras`, `sistema_origens` (cadastros de configuração)
- `sistema_clientes` (com contatos e endereços)
- `sistema_orcamentos` (com itens, numeração sequencial, status, vendedor)
- `sistema_pedidos` (gerados ao aprovar orçamento)
- `sistema_ajustes_estoque` (reservas/ajustes)

Com regras de acesso restritas a usuários logados como administradores (mesma proteção já usada no painel admin).

### 2. Proteger a área /sistema com login
Hoje qualquer pessoa que descobrir a URL `/sistema` consegue acessar. Com os dados indo para o banco, é obrigatório exigir login (será usado o mesmo login do admin que já existe). Quem acessar `/sistema` sem estar logado será redirecionado para a tela de login.

### 3. Reescrever a camada de dados do sistema
Trocar o armazenamento local pelo banco de dados em `SistemaContext`:
- Carregar tudo do banco ao abrir o sistema
- Criar/editar/excluir salvando direto no banco
- A página `/sistema/orcamentos` passa a listar **todos os orçamentos de todos os vendedores**, com a coluna de vendedor visível

### 4. Migração dos dados existentes
Na primeira vez que o sistema abrir após a atualização, os dados que existirem no navegador (localStorage) serão enviados automaticamente para o banco, para não perder nada que já foi cadastrado naquele computador.

## Detalhes técnicos

- Migração SQL criando as tabelas com GRANTs + RLS restrito a `admin_users` (mesmo padrão das tabelas admin existentes)
- Itens de orçamento/pedido, contatos e endereços armazenados como JSONB (mantém a estrutura atual sem mudar as telas)
- Numeração de orçamento gerada no banco (sequence) para evitar números duplicados entre vendedores
- `SistemaContext.tsx` reescrito para usar o cliente do backend com carregamento inicial + mutações; telas existentes (Orcamentos, Pedidos, Clientes, Configuracoes, OrcamentoForm) continuam funcionando com a mesma interface do contexto
- Guard de rota em `/sistema` reaproveitando a checagem de sessão do admin

## Importante

Os dados que foram cadastrados em **outros computadores/navegadores** e já sumiram não podem ser recuperados — só os que ainda existirem no navegador atual serão migrados.