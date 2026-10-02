-- =====================================================================
-- GIFT WEB - Melhora os 4 prompts do Mockup Studio: mais específicos sobre
-- qualidade fotográfica/nitidez e, no caso da composição, pede sombra de
-- contato e casamento de perspectiva -- é o que fazia a logo parecer "colada"
-- em vez de aplicada de verdade no produto.
--
-- Usa UPDATE (não INSERT ... ON CONFLICT DO NOTHING como nas migrations
-- anteriores) de propósito: a tabela já tem linhas desde a migration
-- 20261003100000, e sem isso o texto novo nunca entraria em uso -- a edge
-- function sempre prioriza o que está no banco sobre o texto padrão do
-- código.
-- =====================================================================

update public.mockup_ia_prompts set prompt =
  'This logo will be laser engraved on stainless steel. Remove the background completely (fully transparent, ' ||
  'clean edges). Do NOT redesign, reinterpret or recreate the logo -- keep every letter, symbol, line, proportion ' ||
  'and spacing exactly as in the original, pixel-for-pixel where possible. Convert the artwork to a clean ' ||
  'monochrome look with a bright brushed-steel/silver metallic finish, like a real laser engraving sample, ' ||
  'preserving all fine details and transparency where it already existed. Output at the highest resolution and ' ||
  'sharpness you can produce (at least 1024x1024, no upscale blur, no JPEG compression artifacts, no plastic/AI-' ||
  'render look). This is for a real commercial product catalog, not a concept or illustration -- it must look ' ||
  'like an actual photograph.'
where chave = 'logo_laser';

update public.mockup_ia_prompts set prompt =
  'This logo will be printed with DTF UV (full color, with a glossy surface and a slight raised varnish relief). ' ||
  'Remove the background completely (fully transparent, clean edges) if there is one. Do NOT redesign, ' ||
  'reinterpret or recreate the logo or its colors -- keep letters, symbols, proportions, contours and small ' ||
  'details exactly as in the original. Do not add any outline, element, text or effect that was not requested. ' ||
  'Output at the highest resolution and sharpness you can produce (at least 1024x1024, no upscale blur, no JPEG ' ||
  'compression artifacts, no plastic/AI-render look). This is for a real commercial product catalog, not a ' ||
  'concept or illustration -- it must look like an actual photograph.'
where chave = 'logo_dtf_uv';

update public.mockup_ia_prompts set prompt =
  'This logo will be printed with DTF for fabric application. Remove the background completely (fully ' ||
  'transparent, clean edges) if there is one. Do NOT redesign, reinterpret or recreate the logo or its colors -- ' ||
  'keep letters, symbols, proportions, contours and small details exactly as in the original. Do not make it ' ||
  'look embroidered and do not add textures inside the artwork. Output at the highest resolution and sharpness ' ||
  'you can produce (at least 1024x1024, no upscale blur, no JPEG compression artifacts, no plastic/AI-render ' ||
  'look). This is for a real commercial product catalog, not a concept or illustration -- it must look like an ' ||
  'actual photograph.'
where chave = 'logo_dtf_textil';

update public.mockup_ia_prompts set prompt =
  'This image shows a real product with a logo already placed on top, as a mockup preview, photographed for a ' ||
  'corporate gifts catalog. Your ONLY job is to make the logo look physically applied to the product''s surface: ' ||
  'add a subtle contact shadow where the logo meets the surface, match the logo''s perspective and (if the ' ||
  'surface is curved, like a bottle or mug) wrap it slightly to follow that curve, and match the product''s ' ||
  'lighting and color temperature. Do NOT change the product itself in any way (shape, color, material, size, ' ||
  'position) and do NOT redesign, move, resize, recolor, crop or reinterpret the logo -- its letters, symbols, ' ||
  'proportions and exact content must stay identical to the input. Do not add, remove or invent any element, ' ||
  'text or background detail that is not already in the image. Output at the highest resolution and sharpness ' ||
  'you can produce (at least 1024x1024, no upscale blur, no JPEG compression artifacts, no plastic/AI-render ' ||
  'look). This is for a real commercial product catalog, not a concept or illustration -- it must look like an ' ||
  'actual photograph.'
where chave = 'composicao';

update public.mockup_ia_prompts set prompt =
  'This is a product catalog photo with a plain white/flat studio background. Remove the background completely ' ||
  '(fully transparent, clean edges, no white halo or fringing around the product). Do NOT change the product ' ||
  'itself in any way -- shape, color, material, proportions, labels, logos already printed on it, reflections and ' ||
  'highlights must stay pixel-for-pixel identical. Do not add shadows, textures, reflections or any new element. ' ||
  'Output at the highest resolution and sharpness you can produce (at least 1024x1024, no upscale blur, no JPEG ' ||
  'compression artifacts, no plastic/AI-render look). This is for a real commercial product catalog, not a ' ||
  'concept or illustration -- it must look like an actual photograph.'
where chave = 'produto';
