-- =====================================================================
-- GIFT WEB - Mockup Studio: prompt pra remover o fundo branco da foto do
-- produto (vem assim da XBZ) via IA, igual já existe pra logo/composição.
-- =====================================================================

insert into public.mockup_ia_prompts (chave, prompt) values
  ('produto',
    'This is a product catalog photo with a plain white/flat background. Remove the background completely ' ||
    '(transparent), keeping a clean, high quality cutout of the product. Do NOT change the product itself -- shape, ' ||
    'color, material, proportions, labels, logos already printed on it and reflections must stay exactly the same. ' ||
    'Do not add shadows, textures or any new element. Preserve maximum image sharpness and detail, do not blur or ' ||
    'lower the resolution.')
on conflict (chave) do nothing;
