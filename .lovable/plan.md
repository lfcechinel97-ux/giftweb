## Liberar acesso ao painel admin

Os dois e-mails já estão cadastrados no Cloud (você fez certo!), mas falta um passo: marcá-los como administradores na tabela `admin_users`. É isso que controla o acesso ao `/admin` e ao `/sistema`.

### O que vou fazer

Inserir os dois usuários na tabela `admin_users`:
- `biancagiftweb@gmail.com` (id já existe no Cloud)
- `leandro.giftweb@gmail.com` (id já existe no Cloud)

Depois disso, eles fazem login normalmente em `/admin/login` com a senha que você definiu no Cloud.

### Senhas

Não consigo definir/ver senhas pelo plano — quem define é você no Cloud. Como você disse que quer usar o nome deles:
1. Abra **Cloud → Users**
2. Clique em cada usuário → **Reset password** (ou "Send recovery") e coloque:
   - Bianca: senha `bianca` (ou `Bianca123` se o Cloud exigir maiúscula/número)
   - Leandro: senha `leandro` (idem)

Se o Cloud reclamar de senha fraca, use `Bianca@2026` / `Leandro@2026`.

### Como cadastrar novos admins no futuro (passo a passo)

1. **Cloud → Users → Add user** → preencha e-mail e senha → Create.
2. Me peça aqui: *"adiciona fulano@email.com como admin"* — eu rodo o insert na `admin_users`.
3. A pessoa entra em `seusite.com/admin/login`.

> Apenas criar o usuário no Cloud **não** dá acesso ao painel — o `AdminGuard` checa se o id está em `admin_users`. Por isso parecia que "não deu certo".

### (Opcional) Página de gestão de admins

Se quiser, depois posso criar uma tela em `/admin` com lista + botão "Adicionar admin" para você não precisar mais me pedir. Me avise se quer que eu inclua isso.