-- =====================================================================
-- GIFT WEB - Mockup Studio: DTF têxtil saía como imagem colada por cima do
-- tecido (só o fundo mudava). Novo template descreve o acabamento real:
-- transferido a quente, cores sólidas levemente vibrantes, alta definição,
-- toque levemente emborrachado, acompanhando dobras/costuras/luz do tecido.
-- =====================================================================

update public.mockup_ia_prompts set prompt =
  'A logo já colada no {produto} deve parecer estampada em DTF têxtil, transferida a quente no tecido -- não ' ||
  'uma imagem colada por cima. Mantenha as cores originais da logo (não deixe monocromática nem prateada, isso ' ||
  'é acabamento de laser): cores sólidas e levemente vibrantes, alta definição de detalhes e um toque levemente ' ||
  'emborrachado/encorpado sobre o tecido. A estampa acompanha o tecido: segue as dobras, costuras e a curvatura ' ||
  'do produto, recebe a mesma luz e sombra do tecido em volta, e a textura do tecido aparece levemente por ' ||
  'baixo dela. Acabamento acetinado, sem brilho de verniz.'
where chave = 'final_dtf_textil';
