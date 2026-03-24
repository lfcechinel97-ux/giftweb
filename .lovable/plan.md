

## Problema Raiz

Existem **dois problemas** causando a discrepância (API mostra 51 copos rosa, site mostra quase nada):

### Problema 1: Filtro `is_variante=false` elimina 45 de 46 resultados
- No banco: 46 copos com `cor=ROSA`, mas **45 são variantes** e apenas **1 é pai**
- O site filtra `is_variante=false` em todas as páginas, então só mostra 1 produto
- **Solução**: Quando o filtro de cor estiver ativo, remover `is_variante=false` e mostrar cada variante como um card individual (cada uma tem cor e imagem própria)

### Problema 2: 4 produtos sem cor (campo vazio)
- O sync usa `CorWebPrincipal` mas não tem fallback quando está vazio
- **Solução**: No sync, quando `CorWebPrincipal` estiver vazio, extrair a cor das 3 letras após o traço no `CodigoComposto` (ex: `06520-AZU` → `AZU`) e mapear para o nome completo da cor

---

## Plano de Implementação

### 1. Edge Function `sync-products/index.ts`

Adicionar função de fallback para cor:

```typescript
const COR_ABREV: Record<string, string> = {
  'AZU': 'AZUL', 'VRM': 'VERMELHO', 'VRD': 'VERDE', 'VD': 'VERDE',
  'AMR': 'AMARELO', 'PRE': 'PRETO', 'BRA': 'BRANCO', 'ROS': 'ROSA',
  'ROX': 'ROXO', 'LAR': 'LARANJA', 'CIN': 'CINZA', 'MAR': 'MARROM',
  'DOU': 'DOURADO', 'PRA': 'PRATA', 'VIN': 'VINHO', 'GRA': 'GRAFITE',
  'BEG': 'BEGE', 'PNK': 'ROSA', 'CHU': 'CHUMBO', 'MAD': 'MADEIRA',
  'INX': 'INOX', 'TRA': 'TRANSPARENTE', 'KRA': 'KRAFT', 'BAM': 'BAMBU',
  'BRO': 'BRONZE', 'RSE': 'ROSA', 'COB': 'COBRE',
};

function extrairCor(p: any): string | null {
  // 1. Prioridade: CorWebPrincipal
  const corWeb = (p.CorWebPrincipal ?? p.corWebPrincipal ?? "").trim().toUpperCase();
  if (corWeb) return corWeb;
  
  // 2. Fallback: extrair do CodigoComposto (últimas letras após o último traço)
  const codigo = p.CodigoComposto ?? p.codigoComposto ?? "";
  const match = codigo.match(/-([A-Z]{2,4})(?:\/|$)/i);
  if (match) {
    const abrev = match[1].toUpperCase();
    if (COR_ABREV[abrev]) return COR_ABREV[abrev];
  }
  return null;
}
```

Na linha 219, trocar:
```typescript
// antes
cor: p.CorWebPrincipal ?? p.corWebPrincipal ?? null,
// depois
cor: extrairCor(p),
```

### 2. CategoryPage.tsx — Remover `is_variante=false` quando cor está ativa

Na query principal (linha ~105) e na query de cores (linha ~148):
- Quando `selectedCor` estiver preenchido: **não** aplicar `.eq("is_variante", false)`
- Quando sem filtro de cor: manter `.eq("is_variante", false)` (comportamento atual)

Isso faz com que ao filtrar por ROSA, apareçam todos os 46 produtos rosa (pais + variantes), cada um com sua imagem e cor própria.

### 3. AllProducts.tsx — Mesma lógica

Aplicar a mesma regra: quando cor ativa, não filtrar `is_variante=false`.

### 4. Resync necessário

Após deploy do sync atualizado, será necessário rodar uma nova sincronização para que os 4 produtos sem cor recebam o valor correto via fallback do `CodigoComposto`.

---

## Arquivos a editar
- `supabase/functions/sync-products/index.ts` — adicionar `extrairCor()` com fallback
- `src/pages/CategoryPage.tsx` — condicional no filtro `is_variante`
- `src/pages/AllProducts.tsx` — mesma condicional

