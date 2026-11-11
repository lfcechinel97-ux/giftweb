import { type ConfigMaster, volUnMediana } from "./caixaMaster";
import { ehCilindrico, ehDobravel, medida } from "./regras";

/* De onde vem a medida de um produto, na ordem de prioridade:
   0. Manual (o vendedor editou a linha agora – sempre vence, é o que ele vê)
   1. Calibrado (mediana dos despachos reais; já inclui o aproveitamento real)
   2. Override salvo (medida fechada, peso, fator de compressão)
   3. Caixa master (volume da caixa ÷ quantidade)
   4. Dimensões da API (3 dimensões > 0)
   Sem nada disso: "sem medida – preencha". Nunca calcula com zero. */

export type Fonte = "manual" | "calibrado" | "override" | "master" | "api";
export type FontePeso = "manual" | "override" | "api" | "calibrado";
export type Confianca = "baixa" | "media" | "alta";
export type Dims = [number, number, number];

export const ROTULO_FONTE: Record<Fonte, string> = {
  manual: "Manual", calibrado: "Calibrado", override: "Override", master: "Caixa master", api: "API",
};

export interface ProdutoApi {
  /** CodigoAmigavel da XBZ (produto, sem cor). */
  codigo: string;
  nome: string;
  pesoG: number | null;
  altura: number | null;
  largura: number | null;
  profundidade: number | null;
}

export interface Override {
  altura_cm: number | null;
  largura_cm: number | null;
  profundidade_cm: number | null;
  peso_g: number | null;
  fator_compressao: number | null;
  vol_efetivo_un_cm3: number | null;
}

export interface Calibrado {
  volUn: number | null;
  pesoUnG: number | null;
  n: number;
}

/** O que o vendedor digitou na linha (só vale o que estiver preenchido). */
export interface EntradaManual {
  altura?: number | null;
  largura?: number | null;
  profundidade?: number | null;
  pesoG?: number | null;
  fatorCompressao?: number | null;
}

export interface Fatores {
  aproveitamentoApi: number;
  aproveitamentoMaster: number;
}

export interface Alerta {
  tipo: "erro" | "aviso" | "info";
  codigo: "sem_medida" | "sem_peso" | "falta_profundidade" | "profundidade_assumida" | "dobravel" | "outlier" | "master_revisar" | "nao_cabe";
  texto: string;
}

export interface MedidaResolvida {
  fonte: Fonte | null;
  /** volume real ocupado por unidade (cm³), antes do fator de aproveitamento. */
  volEfetivoUn: number | null;
  fatorAproveitamento: number;
  /** volume que a unidade "gasta" da caixa = volEfetivoUn ÷ aproveitamento. */
  volEquivalente: number | null;
  /** dimensões da unidade para o teste de encaixe (só quando são reais). */
  dims: Dims | null;
  /** proporção para desenhar no 3D quando não há dimensões reais. */
  proporcao: Dims | null;
  /** dimensões exibidas/editáveis na linha (antes da compressão). */
  dimsExibidas: Dims | null;
  fatorCompressao: number;
  pesoG: number | null;
  fontePeso: FontePeso | null;
  confianca: Confianca;
  alertas: Alerta[];
  configMaster: ConfigMaster | null;
}

export interface EntradaResolucao {
  produto: ProdutoApi;
  fatores: Fatores;
  configsMaster?: ConfigMaster[];
  /** chave da configuração master escolhida; sem isso usa a mediana. */
  masterEscolhida?: string | null;
  masterEmRevisao?: number;
  override?: Override | null;
  calibrado?: Calibrado | null;
  manual?: EntradaManual | null;
}

export const confiancaCalibrado = (n: number): Confianca => (n >= 10 ? "alta" : n >= 3 ? "media" : "baixa");

const tresDims = (a: number | null | undefined, l: number | null | undefined, p: number | null | undefined): Dims | null => {
  const A = medida(a), L = medida(l), P = medida(p);
  return A && L && P ? [L, A, P] : null;
};

/** Dimensões da API, completando a profundidade de itens cilíndricos. */
export function dimsDaApi(p: ProdutoApi): { dims: Dims | null; alertas: Alerta[] } {
  const A = medida(p.altura), L = medida(p.largura), P = medida(p.profundidade);
  if (A && L && P) return { dims: [L, A, P], alertas: [] };
  if (A && L && !P) {
    if (ehCilindrico(p.nome)) {
      return {
        dims: [L, A, L],
        alertas: [{ tipo: "info", codigo: "profundidade_assumida", texto: "Profundidade assumida igual ao diâmetro." }],
      };
    }
    return { dims: null, alertas: [{ tipo: "aviso", codigo: "falta_profundidade", texto: "A API não tem a profundidade: preencha." }] };
  }
  return { dims: null, alertas: [] };
}

export function resolverMedida(e: EntradaResolucao): MedidaResolvida {
  const { produto: p, fatores, override: ov, calibrado: cal, manual: man } = e;
  const alertas: Alerta[] = [];
  const configs = e.configsMaster ?? [];
  const api = dimsDaApi(p);

  // Configuração master: a escolhida ou a mediana
  let configMaster: ConfigMaster | null = null;
  let volMaster: number | null = null;
  if (configs.length) {
    const escolhida = e.masterEscolhida ? configs.find((c) => c.chave === e.masterEscolhida) : undefined;
    if (escolhida) { configMaster = escolhida; volMaster = escolhida.volUn; }
    else {
      volMaster = volUnMediana(configs);
      configMaster = configs.reduce((a, b) => (Math.abs(b.volUn - volMaster!) < Math.abs(a.volUn - volMaster!) ? b : a));
    }
  }
  const proporcaoMaster: Dims | null = configMaster ? [configMaster.largura, configMaster.altura, configMaster.comprimento] : null;

  const dimsManual = man ? tresDims(man.altura, man.largura, man.profundidade) : null;
  const dimsOverride = ov ? tresDims(ov.altura_cm, ov.largura_cm, ov.profundidade_cm) : null;
  const compressao = medida(man?.fatorCompressao) ?? medida(ov?.fator_compressao) ?? 1;

  // `null as …`: estas variáveis mudam dentro de usarDims (o TS não acompanha)
  let fonte = null as Fonte | null;
  let volEfetivoUn = null as number | null;
  let fator = 1;
  let dims = null as Dims | null;
  let dimsExibidas = null as Dims | null;
  let proporcao = null as Dims | null;

  const usarDims = (d: Dims, f: Fonte) => {
    fonte = f;
    dimsExibidas = d;
    volEfetivoUn = d[0] * d[1] * d[2] * compressao;
    fator = fatores.aproveitamentoApi;
    // comprimido, a unidade não tem mais essas dimensões: sem teste de encaixe
    if (compressao >= 1) dims = d;
    else proporcao = d;
  };

  if (dimsManual) usarDims(dimsManual, "manual");
  else if (cal && medida(cal.volUn)) {
    fonte = "calibrado"; volEfetivoUn = cal.volUn; fator = 1;
    proporcao = proporcaoMaster ?? dimsOverride ?? api.dims;
  } else if (ov && medida(ov.vol_efetivo_un_cm3)) {
    fonte = "override"; volEfetivoUn = ov.vol_efetivo_un_cm3; fator = 1;
    proporcao = proporcaoMaster ?? dimsOverride ?? api.dims;
  } else if (dimsOverride) usarDims(dimsOverride, "override");
  else if (volMaster) {
    fonte = "master"; volEfetivoUn = volMaster; fator = fatores.aproveitamentoMaster;
    proporcao = proporcaoMaster;
  } else if (api.dims) {
    usarDims(api.dims, "api");
    alertas.push(...api.alertas);
  }

  if (!fonte) {
    alertas.push(...api.alertas.filter((a) => a.codigo === "falta_profundidade"));
    alertas.push({ tipo: "erro", codigo: "sem_medida", texto: "Sem medida — preencha as dimensões." });
  }
  if (!dimsExibidas) dimsExibidas = dimsOverride ?? api.dims;

  if (fonte === "api" && ehDobravel(p.nome) && compressao >= 1 && !configs.length) {
    alertas.push({
      tipo: "aviso", codigo: "dobravel",
      texto: "Medida da API pode ser do produto aberto. Informe a medida fechada ou um fator de compressão.",
    });
  }
  if (fonte === "api" && api.dims && api.dims.some((d) => d > 120)) {
    alertas.push({ tipo: "aviso", codigo: "outlier", texto: "Medida da API acima de 120 cm: confira." });
  }
  if (e.masterEmRevisao) {
    alertas.push({
      tipo: "info", codigo: "master_revisar",
      texto: `${e.masterEmRevisao} configuração(ões) de caixa master com erro na planilha ficaram fora do cálculo.`,
    });
  }

  // Peso
  let pesoG: number | null = null;
  let fontePeso: FontePeso | null = null;
  if (medida(man?.pesoG)) { pesoG = medida(man!.pesoG)!; fontePeso = "manual"; }
  else if (medida(ov?.peso_g)) { pesoG = medida(ov!.peso_g)!; fontePeso = "override"; }
  else if (medida(p.pesoG)) { pesoG = medida(p.pesoG)!; fontePeso = "api"; }
  else if (medida(cal?.pesoUnG)) { pesoG = medida(cal!.pesoUnG)!; fontePeso = "calibrado"; }
  if (!pesoG) alertas.push({ tipo: "aviso", codigo: "sem_peso", texto: "Sem peso — informe o peso unitário." });

  // Confiança
  let confianca: Confianca = "baixa";
  if (fonte === "calibrado") confianca = confiancaCalibrado(cal?.n ?? 0);
  else if (fonte === "override") confianca = "alta";
  else if (fonte === "master") confianca = "media";
  else if (fonte === "api") {
    confianca = alertas.some((a) => a.codigo === "dobravel" || a.codigo === "profundidade_assumida" || a.codigo === "outlier")
      ? "baixa" : "media";
  }

  return {
    fonte, volEfetivoUn, fatorAproveitamento: fator,
    volEquivalente: volEfetivoUn ? volEfetivoUn / fator : null,
    dims, proporcao: dims ?? proporcao, dimsExibidas, fatorCompressao: compressao,
    pesoG, fontePeso, confianca, alertas, configMaster,
  };
}
