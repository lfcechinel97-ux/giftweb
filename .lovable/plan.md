

## Problema

Há **dois bugs** impedindo que as edições no admin reflitam no site:

### 1. Chaves desalinhadas (admin ≠ frontend)

O admin salva com chaves antigas:
- `cat_img_garrafas`, `cat_img_canecas`, `cat_img_mochilas`...

O frontend (CategoriesSection) lê com os slugs novos:
- `cat_img_garrafas-e-squeezes`, `cat_img_copos-e-canecas`, `cat_img_mochilas-e-sacochilas`...

Resultado: o frontend nunca encontra os valores salvos pelo admin.

### 2. `updateValue` faz UPDATE, não UPSERT

Se a row não existir na tabela `site_content`, o UPDATE silenciosamente não faz nada. Não há INSERT automático para rows novas.

---

## Solução

### Arquivo 1: `src/pages/admin/AdminCategoryImages.tsx`

Atualizar a lista de categorias para usar os mesmos slugs que o `topSlugs` do CategoriesSection:

```typescript
const categories = [
  { key: "garrafas-e-squeezes", label: "Garrafas e Squeezes" },
  { key: "copos-e-canecas", label: "Copos e Canecas" },
  { key: "mochilas-e-sacochilas", label: "Mochilas e Sacochilas" },
  { key: "kits", label: "Kits Corporativos" },
  { key: "bolsas", label: "Bolsas e Sacolas" },
  { key: "canetas", label: "Canetas" },
  { key: "chaveiros", label: "Chaveiros" },
];
```

### Arquivo 2: `src/hooks/useSiteContent.ts`

Trocar `updateValue` de UPDATE para UPSERT:

```typescript
const upsertValue = async (id: string, value: string, section?: string) => {
  await supabase
    .from('site_content')
    .upsert({
      id,
      value,
      type: 'image',
      section: section || null,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });
};
```

### Arquivo 3: `src/pages/admin/AdminCategoryImages.tsx` (handleSave)

Passar `section: "categorias"` no upsert para que as rows sejam criadas corretamente quando não existem.

### Resultado
- Admin e frontend usam as mesmas chaves → edições refletem imediatamente
- Upsert garante que rows são criadas se não existirem

