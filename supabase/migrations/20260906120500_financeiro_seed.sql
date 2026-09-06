-- =====================================================================
-- SEED do financeiro, a partir das planilhas do próprio negócio:
--   • 73 custos de produto  ← "Fechamento Produtos 01.06 a 10.07.xlsx"
--   • previsão orçamentária ← "PREVISÃO ORÇAMENTÁRIA GIFT WEB.xlsx" (jun/2026)
--
-- Reexecutável: ON CONFLICT DO NOTHING preserva o que já foi ajustado à
-- mão. Nada da aba FUNCIONÁRIO (salários nominais por pessoa) foi
-- importado — só o total do grupo "Funcionários".
-- =====================================================================

-- ---- Custos de produto ---------------------------------------------
INSERT INTO public.sistema_custo_produto (produto_nome, custo_unitario, origem) VALUES
  ('Bolsa Térmica 10 Litros - Azul', 8.61, 'planilha'),
  ('CANECA CAFÉ 180ML INOX', 6.8, 'planilha'),
  ('CANECA PAREDE DUPLA 550ML', 16.9, 'planilha'),
  ('CANETA C/ 1 ANEL E PONTA TOUCH - AZUL', 1.9, 'planilha'),
  ('Caderneta Couro Sintético C/ Pauta + Fecho e Placa Metálica', 11.73, 'planilha'),
  ('Caderneta Emborrachada - Azul', 4.0, 'planilha'),
  ('Caderneta Emborrachada - Bege', 6.8, 'planilha'),
  ('Caderneta Emborrachada - Marrom', 13.9, 'planilha'),
  ('Caderneta Emborrachada - Preta', 11.0, 'planilha'),
  ('Caderneta Moleskine CS Pauta Branco', 25.0, 'planilha'),
  ('Caderneta Moleskine CS Pauta Preto', 11.0, 'planilha'),
  ('Caderno A5 Plástico - Preto', 4.9, 'planilha'),
  ('Caixa de Som - JBL GO 2', 24.0, 'planilha'),
  ('Caneca Térmica Chopp 700ml Preta', 22.0, 'planilha'),
  ('Caneta Metal Comum Azul', 1.6, 'planilha'),
  ('Caneta Metal Comum Preto', 1.6, 'planilha'),
  ('Caneta Metal Touch - Bronze', 1.7, 'planilha'),
  ('Caneta Metal Touch - Preto', 1.7, 'planilha'),
  ('Caneta Metal Touch Brilho Azul', 1.7, 'planilha'),
  ('Caneta Metal Touch Fosca Azul', 1.7, 'planilha'),
  ('Caneta Metal Touch Preta', 1.7, 'planilha'),
  ('Chaveiro Metal abridor - Azul', 0.84, 'planilha'),
  ('Copo Longneck 3em1 420 mL Preta', 17.0, 'planilha'),
  ('Copo Térmico 473 ml com tampa Azul Marinho', 10.5, 'planilha'),
  ('Copo Térmico 473 ml com tampa Azul Royal', 10.5, 'planilha'),
  ('Copo Térmico 473 ml com tampa Branco', 10.5, 'planilha'),
  ('Copo Térmico 473 ml com tampa Laranja', 10.5, 'planilha'),
  ('Copo Térmico 473 ml com tampa Preto', 10.5, 'planilha'),
  ('Copo Térmico 473 ml com tampa Rosa Bebe', 10.5, 'planilha'),
  ('Copo Térmico 473 ml com tampa Verde Militar', 10.5, 'planilha'),
  ('Copo Térmico Cuia 350 mL Azul Marinho', 10.5, 'planilha'),
  ('Copo Térmico Cuia 350 mL Branco', 10.5, 'planilha'),
  ('Copo Térmico Cuia 350 mL Preto', 10.5, 'planilha'),
  ('Coqueteleira Térmica 700 mL - Preto', 33.9, 'planilha'),
  ('GARRAFA TÉRMICA 400ML C/ TERMÔMETRO - BRANCO', 10.5, 'planilha'),
  ('GARRAFA TÉRMICA INOX 750ML', 26.0, 'planilha'),
  ('GARRAFA TÉRMICA INOX 750ML - BRANCO', 22.0, 'planilha'),
  ('GARRAFA TÉRMICA INOX 750ML - INOX', 26.0, 'planilha'),
  ('GARRAFA TÉRMICA INOX 750ML - PRETO', 22.0, 'planilha'),
  ('Garrafa Flip 650 ml - Azul', 25.0, 'planilha'),
  ('Garrafa Led Termômetro 500 mL Azul', 10.5, 'planilha'),
  ('Garrafa Led Termômetro 500 mL Branco', 10.5, 'planilha'),
  ('Garrafa Led Termômetro 500 mL Preto', 10.5, 'planilha'),
  ('Garrafa Pacco 750 ml Branco', 22.0, 'planilha'),
  ('Garrafa Quencher 1,2L Branco', 28.0, 'planilha'),
  ('Garrafa Quencher 1,2L Preto', 28.0, 'planilha'),
  ('Garrafa Quencher 1,2L Rosa Bebê', 28.0, 'planilha'),
  ('Garrafa Térmica 1 litro Branca', 32.9, 'planilha'),
  ('Garrafa Térmica 1 litro Preta', 32.9, 'planilha'),
  ('Garrafa Térmica 850ml Branca', 33.9, 'planilha'),
  ('Garrafa Térmica 850ml Preta', 22.0, 'planilha'),
  ('Guarda chuva automático - Branco', 13.5, 'planilha'),
  ('Guarda chuva manual - Branco', 12.5, 'planilha'),
  ('Guarda-chuva Automático - Laranja', 22.99, 'planilha'),
  ('Kit Churrasco 2 Peças', 16.8, 'planilha'),
  ('Kit Garrafa + Xícara 450ml - Preta', 17.0, 'planilha'),
  ('Kit Xícara + Pires - Cerâmica', 13.05, 'planilha'),
  ('MOCHILA DE NYLON USB 20L', 36.5, 'planilha'),
  ('MOCHILA DE NYLON USB 20L - PRETO', 36.5, 'planilha'),
  ('MOCHILA NYLON 28L - PRETA', 33.9, 'planilha'),
  ('Mouse Pad ergonômico', 4.2, 'planilha'),
  ('NECESSAIRE ORGANIZADORA - PRETO', 18.9, 'planilha'),
  ('Pochete de Poliéster - Preto', 18.25, 'planilha'),
  ('Porta Joias - Salmão', 8.2, 'planilha'),
  ('SACOLA TNT METALIZADA - AZUL', 4.56, 'planilha'),
  ('Saca-rolhas Metal', 4.37, 'planilha'),
  ('Sacochila Poliéster Preto', 3.4, 'planilha'),
  ('Sacochila TNT Azul', 2.2, 'planilha'),
  ('Sacola de TNT c/ alça (26,9x34,9) Bio - Azul Escuro', 1.35, 'planilha'),
  ('Squeeze Alumínio 650ml', 10.9, 'planilha'),
  ('Squeeze Alumínio 650ml - Inox', 10.8, 'planilha'),
  ('Squeeze Alumínio 650ml Preto', 10.8, 'planilha'),
  ('Squeeze Alumínio 650ml azul', 10.9, 'planilha')
ON CONFLICT (nome_chave) DO NOTHING;

-- ---- Previsão orçamentária de junho/2026 ----------------------------
-- Serve de modelo: sem linha para o mês corrente, o dashboard cai na
-- competência mais recente cadastrada.
INSERT INTO public.sistema_orcamento (competencia, categoria_id, previsto)
SELECT '2026-06-01'::date, c.id, v.previsto
FROM (VALUES
  ('ADS', 11000.0::numeric),
  ('Aluguel', 5310.0::numeric),
  ('Alvará', 58.33::numeric),
  ('Calcme', 399.0::numeric),
  ('Canva', 12.08::numeric),
  ('ChatGPT', 39.99::numeric),
  ('Comissão', 0.0::numeric),
  ('Confraternização', 120.0::numeric),
  ('Contabilidade', 800.0::numeric),
  ('Despesas bancárias', 100.0::numeric),
  ('Doação', 83.33::numeric),
  ('Empréstimo pai', 1100.0::numeric),
  ('Energia', 291.67::numeric),
  ('Funcionários', 14049.54::numeric),
  ('Hospedagem do site', 19.9::numeric),
  ('Imposto', 9183.52::numeric),
  ('Internet', 180.0::numeric),
  ('Material de escritório', 0.0::numeric),
  ('Material de limpeza', 250.0::numeric),
  ('Medicina do trabalho', 170.0::numeric),
  ('Patrocínio', 0.0::numeric),
  ('Pró-labore', 10000.0::numeric),
  ('Retirada mãe', 1000.0::numeric),
  ('Sindicato', 67.28::numeric),
  ('Taxa de capitalização', 40.0::numeric),
  ('Taxa de cartão', 1637.69::numeric),
  ('Time is Money', 370.0::numeric),
  ('Transporte', 3000.0::numeric),
  ('Vectorizer', 53.44::numeric),
  ('Verisure', 275.0::numeric),
  ('Água', 165.0::numeric)
) AS v(categoria, previsto)
JOIN public.sistema_despesa_categorias c ON c.nome = v.categoria
ON CONFLICT (competencia, categoria_id) DO NOTHING;
