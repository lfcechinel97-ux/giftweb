# Grid editorial para /topprodutos

Proposta antes de implementar. Nada aqui toca no site principal — só na rota `/topprodutos` e em `/admin/topprodutos`.

## 1. Conceito — mosaico com ritmo, não grade

Cada categoria vira uma **seção editorial** com composição própria. Três tamanhos de célula:

- `L` (grande) — 2 col × 2 row, foto lifestyle grande, tipografia em destaque
- `M` (médio) — 2 col × 1 row ou 1 col × 2 row, foto ampla
- `S` (padrão) — 1 col × 1 row, card discreto

Base: grid de **4 colunas no desktop / 2 no mobile**, com auto-flow denso (CSS Grid `grid-auto-flow: dense`) — o navegador preenche buracos automaticamente, então nada de vazio esquisito por mais destaques que eu marque.

## 2. Três composições distintas (uma por categoria)

Para provar que não é template repetido, cada categoria tem um "template de mosaico" diferente, escolhido pela quantidade e posição dos destaques que eu marcar no admin. Exemplos:

### Categoria A — "Garrafas de Água" (1 destaque grande + resto padrão)

```text
+---------------+-------+-------+
|               |   S   |   S   |
|      L        +-------+-------+
|   (lifestyle) |   S   |   S   |
+-------+-------+-------+-------+
|   S   |   S   |   S   |   S   |
+-------+-------+-------+-------+
```
Cabeçalho: título serifado grande à esquerda, contagem "12 modelos" à direita, linha fina embaixo.

### Categoria B — "Kit Churrasco/Vinho" (2 médios lado a lado + padrão)

```text
+---------------+---------------+
|       M       |       M       |
|   (lifestyle) |   (lifestyle) |
+-------+-------+-------+-------+
|   S   |   S   |   S   |   S   |
+-------+-------+-------+-------+
|   S   |   S   |   S   |   S   |
+-------+-------+-------+-------+
```
Cabeçalho: número da seção "02" em display gigante ao lado do título.

### Categoria C — "Som e Power Bank" (destaque vertical + zig-zag)

```text
+-------+-------+---------------+
|   S   |   S   |               |
+-------+-------+      M        |
|   S   |   S   |   (vertical)  |
+-------+-------+-------+-------+
|       M       |   S   |   S   |
|   (horizontal)+-------+-------+
+---------------+   S   |   S   |
                +-------+-------+
```
Cabeçalho: tag categoria à esquerda em uppercase pequeno, título grande centralizado.

Categorias sem nenhum destaque marcado caem num grid limpo de 4 colunas de `S`, com cabeçalho mais discreto — ainda respira, não parece bugado.

## 3. Tratamento de imagem (resolve o corte estranho)

- `S`: `aspect-[4/5]`, `object-contain`, padding 24px, fundo `#f5f5f2` bem sutil.
- `M`/`L`: `object-cover` quando existe imagem lifestyle (que preenche a moldura); `object-contain` com padding 48px quando é foto de produto isolado. Detecção automática pelo tipo de imagem cadastrada (campo separado no admin — ver abaixo).
- Foto principal e hover continuam funcionando em todos os tamanhos.

## 4. Admin — controle manual

Em `/admin/topprodutos`, cada produto ganha:

- **Destaque no grid**: rádio `Padrão` / `Destaque médio` / `Destaque grande`
- **Imagem editorial (opcional)**: upload separado, usado só quando o produto está em modo médio ou grande. Se vazio, cai na imagem principal.
- **Ordem** já existe — continua controlando a posição dentro da categoria.

Em `/admin/topprodutos` cabeçalho da lista, agrupamento visual por categoria com contador tipo "3 destaques marcados" pra eu ver o balanço.

Nova aba/tela leve **Categorias** em `/admin/topprodutos/categorias`:
- Upload de **imagem de capa** por categoria (opcional).
- Texto curto opcional (kicker/eyebrow).
- Se vazio, cabeçalho volta ao estilo minimalista atual.

## 5. Comportamento adaptativo

- Mobile: mosaico simplifica pra 2 colunas. `L` vira full-width (2×2), `M` vira 2×1, `S` vira 1×1. Mantém ritmo sem ficar apertado.
- `grid-auto-flow: dense` garante zero buracos, não importa quantos destaques.
- Se marco 5 destaques grandes numa categoria, o grid absorve — não sobrepõe.

## 6. O que fica igual

Hover troca imagem, thumbs de variação, preço, MOQ, botão adicionar, modal de detalhe, carrinho, WhatsApp — sem mexer.

---

## Detalhes técnicos

- **DB**: `ALTER TABLE topprodutos_curadoria ADD COLUMN destaque text default 'padrao' CHECK (destaque IN ('padrao','medio','grande'))`, `ADD COLUMN imagem_editorial text`. Nova tabela `topprodutos_categorias_meta (slug pk, imagem_capa, eyebrow, updated_at)`.
- **Grid**: CSS Grid `grid-template-columns: repeat(4, 1fr); grid-auto-flow: dense;` com `grid-column: span N; grid-row: span N` em cada card conforme destaque.
- **Card**: `TopProductCard` ganha prop `size: 'S' | 'M' | 'L'` que define aspect, padding, tipografia (título 14px em S, 20px em M, 32px em L) e escolhe entre `image_url` e `imagem_editorial`.
- **Admin**: `AdminTopProdutos.tsx` ganha campo radio de destaque + upload extra. Nova rota `AdminTopProdutosCategorias.tsx` para as capas.

## Pergunta antes de implementar

Confirma o esquema de 3 níveis (Padrão/Médio/Grande) e o grid base de 4 colunas? Se preferir 2 níveis (Padrão/Destaque) ou 6 colunas mais denso, ajusto agora antes de codar.
