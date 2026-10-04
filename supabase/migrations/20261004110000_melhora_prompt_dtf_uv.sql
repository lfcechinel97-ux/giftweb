-- =====================================================================
-- GIFT WEB - O resultado em DTF UV estava saindo parecido com laser
-- (monocromático/prateado, sem brilho de verniz). Reforça no prompt que
-- DTF UV preserva as cores originais e tem verniz brilhante com relevo --
-- e deixa explícito que NÃO é o acabamento prateado do laser.
-- =====================================================================

update public.mockup_ia_prompts set prompt =
  'Coloque essa logo como se estivesse personalizada em DTF UV no {produto}: mantenha as cores originais da ' ||
  'logo (não deixe monocromática nem prateada, isso é acabamento de laser, não de DTF UV), com uma camada de ' ||
  'verniz bem visível por cima -- brilhante, com leve relevo 3D e reflexo de luz na superfície impressa. A logo ' ||
  'deve ocupar cerca de {pct}% da largura visível do produto, posicionada {posicao}. Mantenha as letras e o ' ||
  'desenho da logo idênticos ao original. Coloque o produto em um cenário de mostruário B2B profissional, ' ||
  'pronto para enviar ao cliente.'
where chave = 'final_dtf_uv';
