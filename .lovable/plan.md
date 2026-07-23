## Objetivo

Replicar em todas as categorias do `/topprodutos` o mesmo padrão de mosaico assimétrico que já existe em "Guarda-chuvas": 1 produto GRANDE (2x2) + 1 produto MÉDIO (2x1) + demais PADRÃO (1x1).

## Situação atual (confirmada na base)

Cada categoria tem 6 produtos curados. Apenas "guarda-chuvas" tem destaques definidos:
- 1× `grande`, 1× `medio`, 4× `padrao`

As outras 7 categorias estão com todos os 6 produtos em `padrao`, o que faz o `CategoriasGrid` cair no caminho "grid uniforme" (sem mosaico) — por isso visualmente parecem diferentes de guarda-chuvas.

Categorias a ajustar:
- caderneta-caneta
- copos-cafe-cerveja
- garrafas-agua
- kit-churrasco-vinho
- mochilas-bolsa-necessaire
- sacola-tnt-algodao
- som-power-bank

## Mudança

Uma única migration que, para cada categoria acima, define:
- o produto com menor `ordem` (empate resolvido por `created_at`) como `destaque = 'grande'`
- o segundo como `destaque = 'medio'`
- os demais permanecem `padrao`

Nenhuma alteração de código/UI — o `CategoriasGrid` já renderiza o mosaico correto assim que existirem destaques na categoria.

## Detalhes técnicos

SQL usará um CTE com `ROW_NUMBER() OVER (PARTITION BY categoria ORDER BY ordem NULLS LAST, created_at)` para escolher a 1ª e 2ª posição de cada categoria (exceto guarda-chuvas, que já está configurada) e aplicar os destaques via `UPDATE ... FROM cte`.

Depois de aplicado, o admin pode ajustar manualmente qual produto é o destaque de cada categoria em `/admin/topprodutos` (o campo "Destaque no grid" continua editável por produto).
