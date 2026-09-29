-- Rede de segurança para a sincronização de produtos: aumenta o tempo
-- máximo que uma consulta pode rodar quando vem do service_role (é o que
-- a function sync-products usa para gravar no products_cache). Sem
-- mudar chunk nenhum -- só dá mais folga para cada lote.
--
-- Opcional: o ajuste do CHUNK_SIZE (500 -> 100) já deve resolver sozinho.
-- Rode isto só se a sincronização voltar a falhar com "statement timeout".
alter role service_role set statement_timeout = '60s';
