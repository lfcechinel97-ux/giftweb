# Volumes de despacho (`/medidadespacho`)

Calculadora interna: SKU(s) + quantidade → quantos volumes, peso real, peso
cubado e dimensão de cada volume. Atrás do `AdminGuard` (qualquer pessoa da
equipe com conta: admin, gerente, vendedor), com `noindex`.

- Página: `src/pages/MedidaDespacho.tsx` (rota em `src/App.tsx`); componentes em `src/pages/medidaDespacho/`.
- Núcleo (sem React, com testes): `src/lib/medidaDespacho/`
  - `regras.ts`: 0 = ausente, palavras de item cilíndrico/dobrável, mediana.
  - `caixaMaster.ts`: classificação das linhas da planilha master e configurações por produto.
  - `fontes.ts`: de onde vem a medida e o peso de cada produto (hierarquia, alertas, confiança).
  - `calculo.ts`: encaixe físico, preenchimento sequencial dos volumes, cubagem, sugestão do último volume.
  - `resumo.ts`: texto para WhatsApp/orçamento.
  - `dados.ts` / `importarMaster.ts`: leitura do Supabase e importação da planilha.
  - `medidaDespacho.test.ts`: casos de teste (`npx vitest run src/lib/medidaDespacho`).

## Como rodar

1. Rodar `supabase/migrations/20261111120000_medidadespacho.sql` no SQL Editor (idempotente).
2. `npm run dev` e abrir `/medidadespacho` logado.
3. Em **Dados → Planilha de caixa master**, importar `Medidas_Caixa_*.xlsx`.

## De onde vêm os dados

- **API XBZ**: não é chamada pela página. As medidas (peso em g, altura,
  largura, profundidade em cm) vêm do `products_cache`, que a edge function
  `sync-products` já atualiza todo dia às 05h (pg_cron, migration
  `20260929120000_agendamento_sync_produtos.sql`). A URL com CNPJ e token
  fica só no secret `XBZ_API_URL` da edge function — nunca no front nem no
  repositório. O botão **Atualizar agora** chama a mesma `sync-products`
  (≈3 min). O `0` da API já vira `NULL` no sync e, por garantia, a calculadora
  trata qualquer `0` como ausente.
- **Produto** = `codigo_prefixo` do `products_cache` (CodigoAmigavel da XBZ,
  ex.: `01116`); as cores são variantes e compartilham a medida.
- **Caixa master** (`xbz_caixa_master`): ligada pela `REFERÊNCIA` sem os `#`
  (`#10078#-AZU` → `10078-AZU`) = CodigoComposto = `products_cache.codigo_amigavel`.
  O `ID` (X000272) é guardado, mas o `products_cache` não tem o CodigoXbz.

## Reimportar a planilha master

Na própria página (Dados → Escolher planilha → Importar). A planilha é lida no
navegador, cada linha é classificada e a tabela é **substituída** numa
transação (RPC `importar_caixa_master`). Classificação:

| status | quando | entra no cálculo? |
|---|---|---|
| `revisar` | dimensão vazia/≤ 0, dimensão > 120 cm, qtd ≤ 0 ou > 20.000, volume por unidade < 1 cm³ (ex.: caixas 1×1×1) | não |
| `inativo` | referência não existe no `products_cache` (descontinuado) | não |
| `ok` | o resto | sim |

Para corrigir uma linha em revisão: corrigir na planilha e importar de novo.
IDs repetidos com caixas diferentes: todas as configurações ficam; o padrão
é a **mediana do volume por unidade**, e o vendedor pode escolher outra.

## Cálculo

Prioridade da medida (por produto):

0. **Manual** – o que o vendedor digitou na linha (vence tudo: é o que ele está vendo).
1. **Calibrado** – mediana dos despachos reais (Fase 3); sem fator de aproveitamento.
2. **Override** – medida fechada/peso/fator de compressão salvos (`medidas_override`).
3. **Caixa master** – `vol_un = L×A×C da master ÷ qtd`, aproveitamento 0,90.
4. **API** – 3 dimensões > 0 × fator de compressão, aproveitamento 0,85.
   Cilíndrico (CANETA, LÁPIS, COPO…) sem profundidade → profundidade = largura.

Peso: manual > override > API > calibrado. Sem medida: "sem medida — preencha"
(nunca calcula com zero). Cada unidade "gasta" `vol_un ÷ aproveitamento` da
caixa; as caixas são preenchidas do maior para o menor item, misturando SKUs,
até acabar o volume ou o peso (`peso máx − tara`). Peso cubado =
`m³ da caixa × fator` (300 rodoviário / 167 aéreo). Último volume parcial:
sugere a mesma largura×comprimento com altura proporcional à ocupação, de 5 em
5 cm, mínimo 10 cm.

Confiança: calibrado por `n` (< 3 baixa, 3–9 média, ≥ 10 alta); override alta;
caixa master média; API média (baixa se dobrável sem compressão, profundidade
assumida ou medida > 120 cm); manual baixa.

Valores padrão em `calc_config` (caixa 60×40×40, 25 kg, tara 0, fatores 0,85 e
0,90, cubagem 300/167). Editar direto na tabela; a tela usa como padrão.

## 3D (ilustrativo)

Botão **Ver em 3D** no resultado. `three@0.170.0` (versão fixa), carregado só
ao abrir (`Visualizador3D.tsx`, chunk separado). `empacotamento.ts` monta cada
volume em camadas com prateleiras 2D, testando as 6 orientações de cada SKU;
um `InstancedMesh` por SKU aguenta milhares de unidades. Sem dimensões reais
(só caixa master/calibrado), a unidade vira um paralelepípedo com o volume
efetivo e as proporções da caixa master ("forma aproximada"). Se o 3D couber
menos unidades do que o cálculo, aparece o aviso — o cálculo por volume
continua sendo o oficial.

## Calibração (`/medidadespacho/calibrar`)

Qualquer pessoa da equipe registra e valida (`is_admin_user()`), e o e-mail de
quem registrou e de quem validou fica gravado no despacho (auditoria).

- **Registrar despacho**: data, pedido, caixa (L×C×A), peso real, ocupação
  (100% = cheia), itens. Ao salvar roda o cálculo atual com os mesmos itens e
  caixa e grava a estimativa (`despachos_historico.estimativa`) → estimado × real.
  Entra como `pendente`. RPC `registrar_despacho` (cabeçalho + itens numa transação).
- **Importar em lote**: CSV (;) ou .xlsx, modelo para download na tela. Colunas:
  `despacho;data;pedido;largura_cm;comprimento_cm;altura_cm;peso_real_kg;ocupacao_pct;codigo;qtd;observacao`.
  Linhas com o mesmo `despacho` = uma caixa com vários produtos.
- **Histórico**: validar / descartar / voltar para pendente.
- **Calibração** (`calibracao.ts`): só despachos **validados com 1 produto**:
  `vol_un = vol_caixa × ocupação ÷ qtd`, `peso_un = (peso − tara) ÷ qtd`. Valor
  = mediana dos últimos 10; os que fogem > 50% da mediana ficam fora e aparecem
  no histórico como "revise". Confiança: n < 3 baixa, 3–9 média, ≥ 10 alta.
  Despachos com vários produtos só medem o erro do modelo.
- **Produtos calibrados**: n, mediana, mín–máx, fonte anterior × calibrada.
  *Promover a override* grava a mediana em `medidas_override.vol_efetivo_un_cm3`
  (e o peso, se o override não tiver) e liga `ignorar_calibracao` (valor
  congelado). *Reverter* liga `ignorar_calibracao` sem gravar volume (volta à
  fonte anterior). *Usar calibração* desliga.
- **Erro do modelo**: erro médio (com sinal e absoluto) de volume e peso,
  geral, por fonte da medida, por palavra-chave (1ª palavra do nome) e por
  produto. Positivo = superestima → subir o fator de aproveitamento em `calc_config`.
