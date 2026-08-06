UPDATE public.sistema_pedidos p
SET itens = (
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', gen_random_uuid(),
      'produtoId', it->>'produtoId',
      'codigoComposto', it->>'codigoComposto',
      'varianteSlug', it->>'varianteSlug',
      'nome', it->>'nome',
      'quantidade', COALESCE((it->>'quantidade')::numeric, 0),
      'precoUnitario', COALESCE((it->>'precoUnitario')::numeric, 0),
      'total', COALESCE((it->>'quantidade')::numeric, 0) * COALESCE((it->>'precoUnitario')::numeric, 0),
      'mockupImagem', it->>'mockupImagem',
      'imagem', it->>'imagem',
      'observacao', it->>'observacao'
    )
  )
  FROM public.sistema_orcamentos o, jsonb_array_elements(o.itens) it
  WHERE o.id = p.orcamento_id
),
updated_at = now()
WHERE p.numero = '100620'
  AND jsonb_array_length(COALESCE(p.itens, '[]'::jsonb)) = 0
  AND p.orcamento_id IS NOT NULL;