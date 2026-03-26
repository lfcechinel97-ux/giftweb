

# Plano: Corrigir CMS de Imagens + Filtro is_hidden

## Dois problemas distintos

### Problema 1: Imagens de categoria não aparecem no site
O banco tem chaves antigas (`cat_img_garrafas`, `cat_img_canecas`, `cat_img_mochilas`...) mas o frontend busca por chaves novas (`cat_img_garrafas-e-squeezes`, `cat_img_copos-e-canecas`, `cat_img_mochilas-e-sacochilas`...). Nunca encontra nada.

### Problema 2: Produtos ocultos aparecem na busca e categorias
As RPCs `search_products_global` e `search_products_by_category` não filtram `is_hidden = true`. O admin marca como oculto, mas o produto continua visível em todo o site.

---

## Solução

### 1. Migration SQL — Migrar chaves antigas + adicionar filtro is_hidden nas RPCs

**Migrar dados existentes:**
```sql
INSERT INTO site_content (id, value, type, section)
SELECT 'cat_img_garrafas-e-squeezes', value, type, section 
FROM site_content WHERE id = 'cat_img_garrafas'
ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value;
-- Repetir para: canecas→copos-e-canecas, mochilas→mochilas-e-sacochilas, squeezes→garrafas-e-squeezes (merge), escritorio→canetas, etc.
```

**Atualizar as 3 RPCs** para adicionar `AND (pc.is_hidden IS NULL OR pc.is_hidden = false)`:
- `search_products_global`
- `search_products_by_category`
- `get_category_colors`

### 2. `src/components/CategoriesSection.tsx` — Fallback para chaves antigas

Na função `getContentValue`, se não encontrar `cat_img_garrafas-e-squeezes`, tentar `cat_img_garrafas` como fallback. Isso garante que funcione durante a transição.

### 3. `src/hooks/useSiteContent.ts` — Carregar todas as rows de categorias

O hook filtra por `section = 'categorias'`, mas as chaves novas (salvas pelo admin atualizado) e as antigas coexistem. Garantir que o fetch traz ambas.

### 4. Homepage queries — Filtrar is_hidden

Revisar `useHomepageData.ts` para adicionar `.neq('is_hidden', true)` nas queries de destaques e mais vendidos.

---

## Arquivos a editar

| Arquivo | Mudança |
|---------|---------|
| **Migration SQL** | Copiar chaves antigas → novas + recriar 3 RPCs com filtro `is_hidden` |
| `src/components/CategoriesSection.tsx` | Fallback para chaves antigas no `getContentValue` |
| `src/hooks/useHomepageData.ts` | Adicionar `.neq('is_hidden', true)` em todas as queries |

## Resultado
- Imagens editadas no admin aparecem imediatamente no site
- Produtos ocultos no admin desaparecem de busca, categorias e homepage
- Compatibilidade com dados antigos preservada via fallback

