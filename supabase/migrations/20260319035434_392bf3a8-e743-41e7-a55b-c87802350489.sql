
-- Create site_content table
CREATE TABLE public.site_content (
  id text PRIMARY KEY,
  type text NOT NULL DEFAULT 'image',
  label text,
  section text,
  value text,
  width_desk integer,
  height_desk integer,
  width_mob integer,
  height_mob integer,
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;

-- Public read
CREATE POLICY "public_read_site_content" ON public.site_content
  FOR SELECT TO anon, authenticated USING (true);

-- Admin write
CREATE POLICY "admin_write_site_content" ON public.site_content
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM admin_users WHERE admin_users.id = auth.uid()));

-- Insert banner rows
INSERT INTO public.site_content (id, type, label, section, width_desk, height_desk, width_mob, height_mob)
VALUES
  ('banner_1_desk', 'image', 'Banner 1 — Desktop', 'banners', 1200, 500, null, null),
  ('banner_1_mob',  'image', 'Banner 1 — Mobile',  'banners', null, null, 390, 300),
  ('banner_2_desk', 'image', 'Banner 2 — Desktop', 'banners', 1200, 500, null, null),
  ('banner_2_mob',  'image', 'Banner 2 — Mobile',  'banners', null, null, 390, 300),
  ('banner_3_desk', 'image', 'Banner 3 — Desktop', 'banners', 1200, 500, null, null),
  ('banner_3_mob',  'image', 'Banner 3 — Mobile',  'banners', null, null, 390, 300)
ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for site images
INSERT INTO storage.buckets (id, name, public) VALUES ('site-images', 'site-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "public_read_site_images" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'site-images');

CREATE POLICY "admin_upload_site_images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'site-images' AND EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));

CREATE POLICY "admin_update_site_images" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'site-images' AND EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));

CREATE POLICY "admin_delete_site_images" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'site-images' AND EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid()));
