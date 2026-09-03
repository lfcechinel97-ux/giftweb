-- Faixa de quantidade configuravel por produto.
--
-- A primeira versao fixou as faixas em 20 / 50 / 100 nos proprios nomes das
-- colunas. Isso nao serve para caneta, sacola e chaveiro, onde a quantidade
-- minima e 100 e a escada comercial e 100 / 200 / 1000. Entao a quantidade
-- de cada degrau passa a ser dado, nao nome de coluna.
--
-- RENAME preserva o conteudo: os precos ja gravados (e qualquer ajuste manual
-- feito no /admin/catalogo-clientes) continuam intactos, so mudam de nome.

ALTER TABLE public.catalogo_clientes RENAME COLUMN preco_20  TO faixa1_preco;
ALTER TABLE public.catalogo_clientes RENAME COLUMN preco_50  TO faixa2_preco;
ALTER TABLE public.catalogo_clientes RENAME COLUMN preco_100 TO faixa3_preco;

ALTER TABLE public.catalogo_clientes
  ADD COLUMN IF NOT EXISTS faixa1_qtd INTEGER,
  ADD COLUMN IF NOT EXISTS faixa2_qtd INTEGER,
  ADD COLUMN IF NOT EXISTS faixa3_qtd INTEGER;

COMMENT ON COLUMN public.catalogo_clientes.faixa1_qtd IS 'Quantidade minima do 1o degrau (tambem e a quantidade inicial do card).';
COMMENT ON COLUMN public.catalogo_clientes.faixa3_qtd IS 'Quantidade minima do 3o degrau - o melhor preco, exibido com "+".';

-- Quem ja tinha preco fica com a escada padrao 20 / 50 / 100.
UPDATE public.catalogo_clientes
SET faixa1_qtd = 20, faixa2_qtd = 50, faixa3_qtd = 100
WHERE faixa1_preco IS NOT NULL AND faixa1_qtd IS NULL;

-- Caneta, sacola e o chaveiro 09824: minimo de 100 un., escada 100 / 200 / 1000.
-- So a quantidade muda. Os tres precos continuam os mesmos - definir preco novo
-- para volume maior e decisao comercial, nao coisa de migration.
UPDATE public.catalogo_clientes
SET faixa1_qtd = 100, faixa2_qtd = 200, faixa3_qtd = 1000
WHERE grupo IN ('canetas', 'sacolas') OR codigo = '09824';
