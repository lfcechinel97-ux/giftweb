

## Mostrar todas as 10 faixas de custo, mesmo sem produtos

### Mudança
Hoje `get_category_cost_distribution` filtra com `HAVING count(DISTINCT pc.id) > 0`, então faixas vazias somem da UI. Vou remover esse filtro: a RPC retornará sempre as 10 faixas fixas, com `total = 0` para as vazias.

### Arquivos

**Migration** — recriar `get_category_cost_distribution(p_category_id uuid)`:
- Remover o `HAVING count > 0`.
- Retornar sempre as 10 bandas (`0,01–0,50` até `70,01+`) com seu `total` (pode ser 0).

**`src/pages/admin/AdminPricing.tsx`**:
- Header do card: trocar "X faixa(s)" por contagem de faixas com produtos (ex.: "29 produto(s) · 5/10 faixa(s) com estoque") para deixar claro que faixas vazias agora aparecem.
- Sub-tabela: linhas com `total = 0` continuam editáveis normalmente (steppers + Aplicar habilitados). A coluna "Produtos" mostra `0` em cinza claro.
- Botão `Aplicar` numa faixa vazia: salva os multiplicadores em `spotlight_categories.tabela_multiplicadores` (memória da config), mas o update em massa de `products_cache` não atinge nenhum produto — toast informa "Configuração salva. 0 produtos nessa faixa atualmente."
- `Aplicar categoria inteira`: itera todas as 10 faixas, salvando a config completa; produtos só são atualizados nas faixas com itens.

### Resultado
- Categoria "Agendas" agora mostra todas as 10 faixas (0,01–0,50 até 70,01+), não só as 5 atuais.
- Admin define multiplicador para a faixa 5,01–10,00 hoje; quando um produto novo entrar nessa faixa via sync (que copia config de categoria) ou edição manual, ele já nascerá precificado conforme.
- Compatível com o formato JSONB existente (`[{min, max, tiers}]`).

