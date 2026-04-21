CREATE OR REPLACE FUNCTION public.admin_set_product_visibility(
  p_product_id uuid,
  p_hidden boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_parent_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admin_users WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Resolve parent (if the given id is a variant, jump to the parent)
  SELECT COALESCE(produto_pai, id) INTO v_parent_id
  FROM products_cache
  WHERE id = p_product_id;

  IF v_parent_id IS NULL THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  -- Update parent
  UPDATE products_cache
  SET is_hidden = p_hidden,
      updated_at = now()
  WHERE id = v_parent_id;

  -- Update all variants
  UPDATE products_cache
  SET is_hidden = p_hidden,
      updated_at = now()
  WHERE produto_pai = v_parent_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_product_visibility(uuid, boolean) TO authenticated;