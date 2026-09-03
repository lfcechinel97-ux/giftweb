# Relatório — Fotos do catálogo HTML (catalogo_aprovados_giftweb.csv)

## Resumo

- Total de produtos processados: 125 (123 com código XBZ + 2 resolvidos por nome: "Garrafa Led Termometro 500 Ml" → 14794, "Garrafa Quencher 1,2L" → 06033)
- **image_url (foto principal): 125/125 preenchida e validada (HTTP 200)**
- image_url_secundaria: 87/125 preenchida — os outros 38 são produtos de variante única (só existe 1 cor/opção na API, não há uma segunda foto real disponível; não inventei substituto)
- Suspeita de marca d'água: 0

## ⚠ Achado importante: a planilha veio com URLs corrompidas

121 das 123 URLs na coluna `foto` estavam com um hífen faltando bem antes do ID numérico
(ex: `BRANCO22790` em vez de `BRANCO-22790`), o que fazia o CDN da XBZ devolver erro em
quase tudo. Não é link morto de verdade — é um problema de formatação de quem gerou essa
planilha.

- 114 delas foram corrigidas automaticamente por regex (reinserindo o hífen) e testadas
  contra o CDN antes de eu confiar nelas.
- As 7 restantes (padrões mais irregulares) foram resolvidas usando a imagem equivalente
  (mesmo código, mesma cor) já coletada direto da API XBZ — é a mesma foto, só que sem a
  corrupção, não uma substituição por outra imagem.

Vale avisar quem gerou essa planilha sobre esse bug, porque vai se repetir em qualquer
lista nova exportada da mesma forma.

## Arquivos gerados

- `output/catalogo_html_produtos.csv` e `.json`: código, nome, categoria, subcategoria,
  custo, origem, image_url, image_url_secundaria — pra você montar o catálogo HTML.
- Todas as imagens hospedadas no bucket `catalogo-meta` do Supabase Storage.

## Produtos sem foto secundária (variante única, sem 2ª cor/foto disponível)

06094, 06096, 07392, 02066, 06070P, 15436, 01361B, 11911S, 05065, 01955, 08232, 01810A,
07048B, 08254, 08255, 04067, 06093, 04065, 12789, 05021, 06064, 05048, 13803N, 01644,
02250, 05184B, 10071G, 03493, 11870, 12046, 10695, 06090, 06089, 18857, 18584B, 18591B,
18599, 18629
