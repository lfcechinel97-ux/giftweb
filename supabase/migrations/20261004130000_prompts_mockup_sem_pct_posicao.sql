-- =====================================================================
-- GIFT WEB - Mockup Studio: tamanho/posição/ângulo da logo deixam de ser um
-- "pedido" em texto (% e posição) pra IA decidir -- agora a Etapa 3 cola a
-- própria logo no produto, no tamanho/posição/ângulo exatos escolhidos
-- (client-side), e a IA só dá acabamento. Por isso os templates não falam
-- mais de %/posição (isso virava instrução redundante e podia até
-- confundir o modelo a tentar "corrigir" um tamanho que já estava certo).
-- =====================================================================

update public.mockup_ia_prompts set prompt =
  'A logo já colada no {produto} deve parecer personalizada a fiber laser: aspecto prateado brilhante ' ||
  'homogêneo, como gravação real em metal.'
where chave = 'final_laser';

update public.mockup_ia_prompts set prompt =
  'A logo já colada no {produto} deve parecer personalizada em DTF UV: mantenha as cores originais da logo ' ||
  '(não deixe monocromática nem prateada, isso é acabamento de laser, não de DTF UV), com uma camada de verniz ' ||
  'bem visível por cima -- brilhante, com leve relevo 3D e reflexo de luz na superfície impressa.'
where chave = 'final_dtf_uv';

update public.mockup_ia_prompts set prompt =
  'A logo já colada no {produto} deve parecer personalizada em DTF têxtil: mantenha as cores originais da ' ||
  'logo (não deixe monocromática nem prateada, isso é acabamento de laser, não de DTF têxtil), acabamento ' ||
  'fosco (sem brilho de verniz) e com a trama do tecido levemente visível por baixo da estampa.'
where chave = 'final_dtf_textil';
