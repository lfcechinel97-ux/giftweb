-- Preco por faixa de quantidade no catalogo de clientes.
--
-- Ate aqui cada produto tinha um preco unico, exibido como "a partir de".
-- Agora o card mostra tres condicoes (20 / 50 / 100+ unidades) para deixar
-- visivel que quanto maior o volume, menor o unitario.
--
-- Os tres precos sao ABSOLUTOS, nao multiplicadores: o que estiver gravado
-- aqui e exatamente o que o cliente enxerga. Isso e proposital - com
-- multiplicador em codigo, um ajuste manual no admin poderia divergir do que
-- aparece no catalogo, e o requisito e que as duas telas leiam o mesmo numero.
--
-- Colunas nascem NULL. Produto sem as tres faixas preenchidas continua se
-- comportando como hoje ("a partir de <preco>", ou "sob consulta" se preco for
-- NULL), entao nada quebra para quem ainda nao foi configurado.

ALTER TABLE public.catalogo_clientes
  ADD COLUMN IF NOT EXISTS preco_20  NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS preco_50  NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS preco_100 NUMERIC(10,2);

COMMENT ON COLUMN public.catalogo_clientes.preco_20  IS 'Preco unitario de 20 a 49 un. NULL = faixa nao configurada.';
COMMENT ON COLUMN public.catalogo_clientes.preco_50  IS 'Preco unitario de 50 a 99 un. NULL = faixa nao configurada.';
COMMENT ON COLUMN public.catalogo_clientes.preco_100 IS 'Preco unitario de 100 un. em diante (melhor preco). NULL = faixa nao configurada.';

-- Carga inicial das faixas.
--
-- O campo "preco" atual ja e custo x 2,5 (conferido contra
-- data/catalogo_aprovados_giftweb.csv: 115 dos 123 produtos batem exato, os
-- outros 8 divergem so no arredondamento do centavo). Como a faixa de 20 un.
-- tambem e custo x 2,5, o preco de 20 un. e o proprio "preco" - ou seja, o
-- valor que o cliente ja via nao muda. As outras duas saem da mesma base:
--
--   preco_50  = (preco / 2,5) x 2,2  =  preco x 0,88
--   preco_100 = (preco / 2,5) x 2,0  =  preco x 0,80
--
-- O WHERE deixa o comando idempotente e nao destrutivo: so preenche quem
-- ainda nao tem faixa nenhuma. Rodar de novo nao sobrescreve ajuste manual
-- feito depois pelo /admin/catalogo-clientes.
UPDATE public.catalogo_clientes
SET preco_20  = ROUND(preco, 2),
    preco_50  = ROUND(preco * 0.88, 2),
    preco_100 = ROUND(preco * 0.80, 2)
WHERE preco IS NOT NULL
  AND preco_20 IS NULL
  AND preco_50 IS NULL
  AND preco_100 IS NULL;
