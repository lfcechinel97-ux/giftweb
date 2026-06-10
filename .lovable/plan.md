
## 1. Banner antigo "Corporate Gift Items" na home

A imagem aparece porque o registro `banner_1_desk` (e `banner_1_mob`) no banco aponta para um arquivo antigo no storage. Não é cache de navegador — é o que está cadastrado.

**Ação:** apagar do `site_content` os 3 banners cadastrados (`banner_1/2/3_desk` e `_mob`). O Hero passa a usar o fallback local `hero-banner.webp` (que é o banner atual da marca). O admin de banners continua disponível para subir novos quando quiser.

## 2. Bug: "garrafa térmica" traz "bolsa térmica"

**Causa raiz** (`supabase/functions/sync-products/index.ts`, linha 110):
```
if (n.includes('GARRAFA') || n.includes('SQUEEZE') || n.includes('TERMICA')) return 'garrafas-e-squeezes';
```
Qualquer produto com "TÉRMICA" no nome (inclusive **bolsa térmica**, **caneca térmica**, **copo térmico**) cai em `garrafas-e-squeezes`. Por isso a busca/categoria mistura tudo.

**Ação:** remover o gatilho solto `TERMICA` dessa regra e aplicar as novas regras descritas abaixo (item 3).

## 3. Reestruturação de categorias

### Renomeações simples (apenas label, slug mantido para não quebrar URLs/SEO)
| Slug | Label novo |
|---|---|
| bolsas | Bolsas Térmicas |
| blocos | Blocos de Anotações |
| fones | Fones de Ouvido |
| malas | Malas de Viagem |
| marmitas | Marmitas p/ Dia a Dia |
| pastas | Pastas Notebook/Tablet |
| sacolas | Sacolas Algodão e TNT |

### Desdobrar `copos-e-canecas` em duas
- `copos` → "Copos"
- `canecas` → "Canecas"
- (slug antigo `copos-e-canecas` desativado; redirect 301 para `/categoria/canecas` para não perder SEO)

### Desdobrar `garrafas-e-squeezes` em duas
- `garrafas-termicas` → "Garrafas Térmicas / Squeezes Térmicos" — produtos cujo nome contém **TÉRMICA/TÉRMICO**
- `garrafas-inox-aluminio` → "Garrafas de Inox / Alumínio" — demais garrafas/squeezes (inox, alumínio, plástica, vidro, etc.)
- slug antigo `garrafas-e-squeezes` desativado; redirect para `garrafas-termicas`

### Kits — manter genérica + 5 novas específicas
Criar 5 categorias específicas (rodam primeiro na regra):
- `kit-churrasco` → "Kit Churrasco" (kit churrasco, tábua churrasco, kit carne, faca churrasco)
- `kit-vinho` → "Kit Vinho" (kit vinho, kit sommelier, saca-rolha)
- `kit-viagem` → "Kit Viagem" (kit viagem, kit de viagem)
- `kit-manicure` → "Kit Manicure" (kit manicure, kit unha)
- `kit-executivo` → "Kit Executivo Escritório" (kit executivo, kit escritório, kit office)

Categoria `kits` continua existindo como fallback (kit café, kit higiene, etc.), conforme escolhido.

### Nova categoria `tabuas-petisqueiras`
- "Tábuas e Petisqueiras" — recebe **tábua, petisqueira, kit queijo** (extraídos da antiga `cozinha-e-mesa`).

### Remover
- `cozinha-e-mesa` → desativada. Produtos remanescentes que não forem tábua/petisqueira/kit queijo cairão em `kits` (kit café, kit cozinha) ou `marmitas`/`copos` conforme palavra-chave.

### Reordenação das regras em `getCategoria` (ordem é crítica)
1. Tábua/petisqueira/kit queijo → `tabuas-petisqueiras`
2. Kit churrasco / vinho / viagem / manicure / executivo → kit específico
3. Bolsa térmica / lancheira / cooler → `bolsas` (rotulada "Bolsas Térmicas")
4. Garrafa+TÉRMICA, Squeeze+TÉRMICA, Chaleira térmica → `garrafas-termicas`
5. Demais garrafa/squeeze → `garrafas-inox-aluminio`
6. Caneca → `canecas` | Copo/Taça → `copos`
7. Resto inalterado, com `kits` como fallback de kit genérico
8. **Remover** a linha que catalogava `TERMICA` solto como garrafa

## 4. Dropdown "Escolha a categoria de brinde" mais bonito

Trocar o `<select>` nativo (que aparece quadradão como na print) por um dropdown custom com:
- Botão arredondado (rounded-xl) com ícone de categoria à esquerda e chevron
- Painel flutuante com sombra suave, cantos arredondados, scroll discreto
- Hover verde-CTA, ícones por categoria, agrupamento visual leve
- Mantém o mesmo comportamento de filtro/navegação
- Mobile-friendly (full-width, scroll interno)

Componente novo: `src/components/HeroCategoryPicker.tsx`, consumido pelo `HeroSection.tsx`.

## Detalhes técnicos

**Migração SQL** (uma única):
1. `UPDATE spotlight_categories SET label = ...` nas 7 renomeações
2. `INSERT` em `spotlight_categories` para: `copos`, `canecas`, `garrafas-termicas`, `garrafas-inox-aluminio`, `tabuas-petisqueiras`, `kit-churrasco`, `kit-vinho`, `kit-viagem`, `kit-manicure`, `kit-executivo`
3. `UPDATE active = false` em `cozinha-e-mesa`, `copos-e-canecas`, `garrafas-e-squeezes`
4. `DELETE FROM site_content WHERE id LIKE 'banner_%_desk' OR id LIKE 'banner_%_mob'` (remove banner antigo)

**Edge function** `sync-products/index.ts`:
- Atualizar `getCategoria` com a nova ordem (item 3)
- Atualizar `CATEGORIA_TO_SLUG` adicionando os 10 novos slugs e removendo os 3 desativados

**Re-mapeamento dos produtos atuais**: ao salvar a migração, rodar também um `UPDATE products_cache SET categoria = ...` simulando a nova `getCategoria` para os produtos atuais, e regravar `product_spotlight_categories`. Assim não é preciso esperar próximo sync para refletir.

**Redirects** (`src/App.tsx`): rotas legadas → novas categorias.

**Arquivos tocados:**
- `supabase/functions/sync-products/index.ts` (regras + map)
- `src/components/HeroSection.tsx` (usar novo picker)
- `src/components/HeroCategoryPicker.tsx` (novo)
- `src/App.tsx` (redirects opcionais p/ slugs antigos)
- 1 migração SQL (categorias + remap de produtos + limpeza de banners)
