# Etapa 1 — índice e cache do preço máximo

Esta aprovação cobre **somente a etapa 1**. As etapas 2–8 terão revisões separadas; nenhuma será aplicada automaticamente com esta aprovação. Nenhuma otimização foi aplicada ainda.

## Linha de base

Mini saudável: memória 50%, conexões 19/60, disco 12%, sem alertas recentes. A consulta de preço máximo leu 11.289 linhas e ordenou o resultado: execução de 200,758 ms em uma medição. Na aplicação: 5 chamadas, média 67,57 ms e máximo 222,55 ms nesta janela.

## Migration proposta — SQL exato

Antes da aplicação, conferir se já existe índice equivalente para evitar duplicação. Criar apenas este índice, sem alterar dados, policies ou permissões:

```sql
CREATE INDEX idx_pc_max_price_visible
ON public.products_cache USING btree (preco_base DESC)
WHERE ativo = true
  AND has_image = true
  AND (is_hidden IS NULL OR is_hidden = false)
  AND preco_base > 0;
```

A criação normal do índice pode aguardar operações de escrita e bloquear escritas brevemente enquanto é construída. O mecanismo de migrations não permite `CONCURRENTLY` dentro da transação; usar janela de baixo movimento e não iniciar durante sync do catálogo. O índice adiciona armazenamento e manutenção nos upserts; medir seu tamanho depois.

## Diff proposto — `src/hooks/useMaxPrice.ts`

```diff
-import { useEffect, useState } from "react";
+import { useQuery } from "@tanstack/react-query";
 import { supabase } from "@/integrations/supabase/client";
 import { precoPadrao } from "@/utils/precoVenda";
 
 const DEFAULT_MAX = 1000;
 
 function ceilTo50(n: number): number {
   return Math.ceil(n / 50) * 50;
 }
 
 export function useMaxPrice() {
-  const [maxPrice, setMaxPrice] = useState(DEFAULT_MAX);
-
-  useEffect(() => {
-    supabase
+  const { data: maxPrice } = useQuery({
+    queryKey: ["catalog-max-price"],
+    staleTime: 60 * 60 * 1000,
+    gcTime: 60 * 60 * 1000,
+    queryFn: async () => {
+      const { data, error } = await supabase
       .from("products_cache")
       .select("preco_base")
       .eq("ativo", true)
       .eq("has_image", true)
       .or("is_hidden.is.null,is_hidden.eq.false")
       .gt("preco_base", 0)
       .order("preco_base", { ascending: false })
-      .limit(1)
-      .then(({ data }) => {
-        if (data && data.length > 0 && data[0].preco_base) {
-          const displayPrice = precoPadrao(data[0], 1000);
-          setMaxPrice(ceilTo50(displayPrice));
-        }
-      });
-  }, []);
+      .limit(1);
+      if (error) throw error;
+      const product = data?.[0];
+      if (!product?.preco_base) return DEFAULT_MAX;
+      return ceilTo50(precoPadrao(product, 1000));
+    },
+  });
 
-  return maxPrice;
+  return maxPrice ?? DEFAULT_MAX;
 }
```

O valor continua usando a fórmula e arredondamento existentes. O cache é compartilhado entre montagens na mesma sessão; atualizar a página completamente inicia um novo cache. `gcTime` também é de 1h para evitar descartar o valor após os 5 minutos padrão sem consumidores. Preços sincronizados podem levar até 1h para refletir no teto do filtro, conforme solicitado.

## Validação após aprovação

1. Capturar o valor atual e EXPLAIN (ANALYZE, BUFFERS), conferir índices equivalentes e ausência de sync em execução.
2. Aplicar a migration acima e verificar o índice no banco.
3. Aplicar somente o diff acima, adicionar teste do cache de 3.600.000 ms e preservação do cálculo/valor padrão.
4. Executar os testes e conferir a navegação real: preço máximo carregado, remount sem nova consulta durante 1h.
5. Repetir EXPLAIN, registrar valor igual, plano, buffers, tempo e tamanho do índice; coletar db_health e slow_queries sem resetar estatísticas.
6. Apresentar o resultado da etapa 1 e preparar a revisão da etapa 2, incluindo os 10 termos antes de trocar a busca.

## Limites

- Sem mudança de tamanho da instância, sem exclusão de dados, sem alteração de cron nesta etapa.
- Rollbacks históricos continuam sob investigação; os contadores recentes foram resetados e não comprovam a causa dos ~84 mil.
- Mídia base64 já identificada em `itens[].imagem` e `itens[].mockupImagem`; nenhuma migração de mídia será executada.