-- 1. NORMALIZAÇÃO GLOBAL ESTRUTURAL DE DADOS LEGADOS E INCONSISTENTES
-- Atualiza simultaneamente os que têm o pipe ('|') e os que estão omissos (NULL),
-- derivando o prefixo da base do codigo_amigavel sem afetar quem já está limpo.
UPDATE products_cache
SET codigo_prefixo = 
  CASE 
    WHEN codigo_prefixo LIKE '%|%' THEN split_part(codigo_prefixo, '|', 1)
    WHEN codigo_prefixo IS NULL THEN split_part(codigo_amigavel, '-', 1)
    ELSE codigo_prefixo
  END
WHERE codigo_prefixo LIKE '%|%' OR codigo_prefixo IS NULL;

-- 2. RECRIAÇÃO DA RPC DE VINCULAÇÃO COM OVERWRITE DIRECIONADO (SEM RESET GLOBAL)
CREATE OR REPLACE FUNCTION public.set_variantes_por_prefixo()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Criação de uma tabela temporária leve na memória para eleger o "Pai" 
  -- de cada grupo existente, respeitando a regra do 'mais curtos e ativos'
  CREATE TEMP TABLE tmp_parents ON COMMIT DROP AS
  SELECT DISTINCT ON (g.codigo_prefixo) g.id, g.codigo_prefixo
  FROM products_cache g
  WHERE g.codigo_prefixo IS NOT NULL AND g.codigo_prefixo != ''
    AND EXISTS (
      SELECT 1 FROM products_cache p2 
      WHERE p2.codigo_prefixo = g.codigo_prefixo AND p2.id != g.id
    )
  ORDER BY g.codigo_prefixo, g.ativo DESC, length(g.codigo_amigavel), g.codigo_amigavel;

  -- 2.1. Desfaz vínculos que não são mais válidos e limpa JSON residual de ex-pais.
  -- Assim EVITAMOS o uso do nocivo: UPDATE products_cache SET produto_pai = NULL (em 100% da base)
  -- A adição do (pc.variantes IS NOT NULL) garante que qualquer produto que ficou solitário perca sua sujeira de JSON.
  UPDATE products_cache pc
  SET produto_pai = NULL, is_variante = false, variantes = NULL, variantes_count = 1
  WHERE (pc.produto_pai IS NOT NULL OR pc.is_variante = true OR pc.variantes IS NOT NULL)
    AND NOT EXISTS (
      SELECT 1 FROM tmp_parents tp WHERE tp.codigo_prefixo = pc.codigo_prefixo
    );

  -- 2.2. Atualiza os "Filhos" apontando-os aos pais recém-eleitos
  UPDATE products_cache v
  SET
    produto_pai = parent.id,
    is_variante = true
  FROM tmp_parents parent
  WHERE v.codigo_prefixo = parent.codigo_prefixo
    AND v.id != parent.id
    -- Só atualiza se o estado do banco estiver diferente do correto (economia de escrita)
    AND (v.produto_pai IS DISTINCT FROM parent.id OR v.is_variante = false);

  -- 2.3. Garante que os "Pais" sejam marcados como pai (is_variante falso) e tira o ponteiro falso
  UPDATE products_cache p
  SET is_variante = false, produto_pai = NULL
  FROM tmp_parents parent
  WHERE p.id = parent.id
    AND (p.is_variante = true OR p.produto_pai IS NOT NULL);

  -- 2.4. Remonta e reconsolida os arrays de variação JSON nas vitrines dos pais
  UPDATE products_cache p
  SET variantes = sub.variantes_json,
      variantes_count = sub.cnt + 1
  FROM (
    SELECT
      produto_pai,
      count(*) AS cnt,
      jsonb_agg(
        jsonb_build_object(
          'slug', slug, 'cor', cor, 'image', image_url, 'estoque', estoque, 'codigo_amigavel', codigo_amigavel
        ) ORDER BY codigo_amigavel
      ) AS variantes_json
    FROM products_cache
    WHERE produto_pai IS NOT NULL AND is_variante = true
    GROUP BY produto_pai
  ) sub
  WHERE p.id = sub.produto_pai;
END;
$function$;

-- 3. REEXECUÇÃO AUTOMÁTICA OBRIGATÓRIA DA NOVA LÓGICA E REATIVAÇÃO PREVENTIVA
-- Otimiza pais pontuais que as anomalias históricas da API desativaram.
UPDATE products_cache SET ativo = true WHERE codigo_amigavel IN ('18645L', '14726B', '14726L') AND ativo = false;

-- Aciona a engrenagem com os dados cirurgicamente estruturados do passo 1.
SELECT set_variantes_por_prefixo();
