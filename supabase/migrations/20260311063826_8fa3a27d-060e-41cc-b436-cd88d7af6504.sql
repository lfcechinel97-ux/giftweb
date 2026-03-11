
ALTER TABLE public.products_cache ADD COLUMN IF NOT EXISTS has_image boolean DEFAULT false;
ALTER TABLE public.products_cache ADD COLUMN IF NOT EXISTS image_urls text[] DEFAULT '{}';

UPDATE public.products_cache SET has_image = (image_url IS NOT NULL AND image_url != '');
