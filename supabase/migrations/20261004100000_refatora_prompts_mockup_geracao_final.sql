-- =====================================================================
-- GIFT WEB - Mockup Studio virou um fluxo de UMA chamada de IA só (Etapa 4,
-- geração final com produto + logo originais), não mais uma por técnica na
-- Etapa 1 (remover fundo/acabamento) mais uma de composição no editor.
-- As chaves antigas (logo_laser, logo_dtf_uv, logo_dtf_textil, composicao,
-- produto) saem; entram final_laser/final_dtf_uv/final_dtf_textil com os
-- templates curtos e descritivos (sem listas de "não faça isso", sem pedir
-- resolução específica -- isso piora o resultado do modelo de imagem).
-- =====================================================================

delete from public.mockup_ia_prompts
 where chave in ('logo_laser', 'logo_dtf_uv', 'logo_dtf_textil', 'composicao', 'produto');

insert into public.mockup_ia_prompts (chave, prompt) values
  ('final_laser',
    'Coloque essa logo como se estivesse personalizada a fiber laser no {produto}. Aspecto prateado brilhante ' ||
    'homogêneo, como gravação real em metal. A logo deve ocupar cerca de {pct}% da largura visível do produto, ' ||
    'posicionada {posicao}. Mantenha as letras e o desenho da logo idênticos ao original. Coloque o produto em um ' ||
    'cenário de mostruário B2B profissional, pronto para enviar ao cliente.'),
  ('final_dtf_uv',
    'Coloque essa logo como se estivesse personalizada em DTF UV no {produto}, cores originais da logo, leve ' ||
    'relevo e brilho de verniz. A logo deve ocupar cerca de {pct}% da largura visível do produto, posicionada ' ||
    '{posicao}. Mantenha as letras e o desenho da logo idênticos ao original. Coloque o produto em um cenário de ' ||
    'mostruário B2B profissional, pronto para enviar ao cliente.'),
  ('final_dtf_textil',
    'Coloque essa logo como se estivesse personalizada em DTF têxtil no {produto}, cores originais da logo, ' ||
    'acabamento fosco com a trama do tecido visível. A logo deve ocupar cerca de {pct}% da largura visível do ' ||
    'produto, posicionada {posicao}. Mantenha as letras e o desenho da logo idênticos ao original. Coloque o ' ||
    'produto em um cenário de mostruário B2B profissional, pronto para enviar ao cliente.')
on conflict (chave) do update set prompt = excluded.prompt;
