import { medida, mediana, normalizarReferencia } from "./regras";

/* Planilha de caixa master (Medidas_Caixa_*.xlsx): uma linha por
   configuração de caixa. O mesmo ID pode aparecer com caixas diferentes:
   todas são guardadas e o cálculo usa a mediana do volume por unidade. */

export const LIMITE_DIMENSAO_CM = 120;
export const LIMITE_QTD_CAIXA = 20000;

export interface LinhaPlanilhaMaster {
  codigo_xbz: string;
  referencia: string;
  descricao: string | null;
  qtd_por_caixa: unknown;
  largura_cm: unknown;
  altura_cm: unknown;
  comprimento_cm: unknown;
}

export type StatusRevisao = "ok" | "revisar" | "inativo";

export interface LinhaMaster {
  codigo_xbz: string;
  referencia: string;
  codigo_composto: string;
  descricao: string | null;
  qtd_por_caixa: number | null;
  largura_cm: number | null;
  altura_cm: number | null;
  comprimento_cm: number | null;
  status_revisao: StatusRevisao;
  motivo_revisao: string | null;
}

/** Classifica uma linha da planilha: erro de digitação evidente → "revisar"
    (fica fora do cálculo); referência que não existe na API → "inativo". */
export function classificarLinhaMaster(
  l: LinhaPlanilhaMaster,
  existeNaApi: (codigoComposto: string) => boolean,
): LinhaMaster {
  const bruto = [l.largura_cm, l.altura_cm, l.comprimento_cm].map((v) =>
    v === null || v === undefined || v === "" ? null : Number(String(v).replace(",", ".")),
  );
  const qtdBruta = l.qtd_por_caixa === null || l.qtd_por_caixa === undefined || l.qtd_por_caixa === ""
    ? null : Number(String(l.qtd_por_caixa).replace(",", "."));
  const motivos: string[] = [];
  if (bruto.some((v) => v === null || !Number.isFinite(v) || v <= 0)) motivos.push("dimensão vazia ou ≤ 0");
  if (bruto.some((v) => v !== null && v > LIMITE_DIMENSAO_CM)) motivos.push(`dimensão > ${LIMITE_DIMENSAO_CM} cm`);
  if (qtdBruta === null || !Number.isFinite(qtdBruta) || qtdBruta <= 0) motivos.push("quantidade por caixa vazia ou ≤ 0");
  else if (qtdBruta > LIMITE_QTD_CAIXA) motivos.push(`quantidade por caixa > ${LIMITE_QTD_CAIXA}`);
  if (!motivos.length) {
    const volUn = (bruto[0]! * bruto[1]! * bruto[2]!) / qtdBruta!;
    if (volUn < 1) motivos.push("volume por unidade < 1 cm³");
  }
  const codigo_composto = normalizarReferencia(String(l.referencia ?? ""));
  let status: StatusRevisao = "ok";
  if (motivos.length) status = "revisar";
  else if (!existeNaApi(codigo_composto)) {
    status = "inativo";
    motivos.push("referência não encontrada na API (provável descontinuado)");
  }
  return {
    codigo_xbz: String(l.codigo_xbz ?? "").trim().toUpperCase(),
    referencia: String(l.referencia ?? "").trim(),
    codigo_composto,
    descricao: l.descricao ? String(l.descricao).trim() : null,
    qtd_por_caixa: qtdBruta !== null && Number.isFinite(qtdBruta) ? Math.round(qtdBruta) : null,
    largura_cm: bruto[0] !== null && Number.isFinite(bruto[0]) ? bruto[0] : null,
    altura_cm: bruto[1] !== null && Number.isFinite(bruto[1]) ? bruto[1] : null,
    comprimento_cm: bruto[2] !== null && Number.isFinite(bruto[2]) ? bruto[2] : null,
    status_revisao: status,
    motivo_revisao: motivos.length ? motivos.join("; ") : null,
  };
}

/** Uma configuração de caixa master válida de um produto. */
export interface ConfigMaster {
  chave: string;
  codigoComposto: string;
  largura: number;
  altura: number;
  comprimento: number;
  qtd: number;
  /** volume da caixa ÷ quantidade (cm³) – já inclui o produto dobrado/embalado. */
  volUn: number;
}

/** Configurações válidas (status "ok") e sem repetição de um produto. */
export function configsMaster(linhas: Pick<LinhaMaster,
  "codigo_composto" | "qtd_por_caixa" | "largura_cm" | "altura_cm" | "comprimento_cm" | "status_revisao">[]): ConfigMaster[] {
  const vistas = new Map<string, ConfigMaster>();
  for (const l of linhas) {
    if (l.status_revisao !== "ok") continue;
    const L = medida(l.largura_cm), A = medida(l.altura_cm), C = medida(l.comprimento_cm), q = medida(l.qtd_por_caixa);
    if (!L || !A || !C || !q) continue;
    const chave = `${L}x${A}x${C}/${q}`;
    if (!vistas.has(chave)) {
      vistas.set(chave, { chave, codigoComposto: l.codigo_composto, largura: L, altura: A, comprimento: C, qtd: q, volUn: (L * A * C) / q });
    }
  }
  return [...vistas.values()].sort((a, b) => a.volUn - b.volUn);
}

/** Volume por unidade padrão: mediana entre as configurações. */
export const volUnMediana = (configs: ConfigMaster[]) => mediana(configs.map((c) => c.volUn));
