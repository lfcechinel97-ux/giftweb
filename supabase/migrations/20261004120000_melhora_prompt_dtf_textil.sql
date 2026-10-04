-- =====================================================================
-- GIFT WEB - Mesmo reforço já aplicado no DTF UV, agora no DTF têxtil: deixa
-- explícito que preserva as cores originais (não monocromático/prateado,
-- que é acabamento de laser), fosco e com a trama do tecido visível.
-- =====================================================================

update public.mockup_ia_prompts set prompt =
  'Coloque essa logo como se estivesse personalizada em DTF têxtil no {produto}: mantenha as cores originais ' ||
  'da logo (não deixe monocromática nem prateada, isso é acabamento de laser, não de DTF têxtil), acabamento ' ||
  'fosco (sem brilho de verniz) e com a trama do tecido levemente visível por baixo da estampa. A logo deve ' ||
  'ocupar cerca de {pct}% da largura visível do produto, posicionada {posicao}. Mantenha as letras e o desenho ' ||
  'da logo idênticos ao original. Coloque o produto em um cenário de mostruário B2B profissional, pronto para ' ||
  'enviar ao cliente.'
where chave = 'final_dtf_textil';
