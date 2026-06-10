
INSERT INTO public.site_content (id, type, section, label, value, updated_at) VALUES
('banner_1_desk','image','banners','Slide 1 Desktop','https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/site-images/banners/banner_1_desk.png', now()),
('banner_1_mob','image','banners','Slide 1 Mobile','https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/site-images/banners/banner_1_mob.webp', now()),
('banner_2_desk','image','banners','Slide 2 Desktop','https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/site-images/banners/banner_2_desk.webp', now()),
('banner_2_mob','image','banners','Slide 2 Mobile','https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/site-images/banners/banner_2_mob.webp', now()),
('banner_3_desk','image','banners','Slide 3 Desktop','https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/site-images/banners/banner_3_desk.webp', now()),
('banner_3_mob','image','banners','Slide 3 Mobile','https://ozkbfxvouxgsdthnweyr.supabase.co/storage/v1/object/public/site-images/banners/banner_3_mob.webp', now())
ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
