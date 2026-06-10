Vou ajustar todos os links padrão do WhatsApp do site para usar diretamente o formato `wa.me` com a mensagem solicitada:

```text
https://wa.me/5548996652844?text=Ol%C3%A1%2C%20vim%20pelo%20site%20e%20quero%20saber%20mais%20sobre%20os%20brindes%21%20LVB
```

Escopo da alteração:
- Atualizar a constante global do site usada por botões, cabeçalho, rodapé, modal e CTAs.
- Atualizar qualquer link fixo que ainda esteja diferente desse padrão.
- Atualizar o link configurável do rodapé salvo no backend, se ele estiver sobrescrevendo o valor do código.
- Manter sem alteração o fluxo do carrinho em `/catalogo`, que monta uma mensagem própria com os itens adicionados.

Observação importante:
- O `wa.me` pode redirecionar automaticamente para `api.whatsapp.com/send` depois do clique; isso é comportamento do WhatsApp. Mas vou garantir que o link cadastrado e renderizado no site comece como `https://wa.me/...` com a mensagem exata pedida.