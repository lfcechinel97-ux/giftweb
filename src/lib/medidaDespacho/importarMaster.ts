import { classificarLinhaMaster, type LinhaMaster, type LinhaPlanilhaMaster } from "./caixaMaster";
import { db, type ProdutoIndice } from "./dados";
import { normalizar } from "./regras";

/* Importa a planilha de caixa master (Medidas_Caixa_*.xlsx) direto da página:
   lê no navegador, classifica cada linha (ok / revisar / inativo) e substitui
   a tabela xbz_caixa_master numa transação (RPC importar_caixa_master).
   Rodar de novo com a planilha atualizada é seguro. */

const COLUNAS: Record<keyof LinhaPlanilhaMaster, string> = {
  codigo_xbz: "ID",
  referencia: "REFERENCIA",
  descricao: "DESCRICAO",
  qtd_por_caixa: "QUANTIDADE POR CAIXA",
  largura_cm: "LARGURA",
  altura_cm: "ALTURA",
  comprimento_cm: "COMPRIMENTO",
};

const valorCelula = (v: unknown): unknown => {
  if (v && typeof v === "object") {
    const o = v as { result?: unknown; text?: unknown; richText?: { text: string }[] };
    if (o.result !== undefined) return o.result;
    if (o.richText) return o.richText.map((r) => r.text).join("");
    if (o.text !== undefined) return o.text;
  }
  return v;
};

export async function lerPlanilhaMaster(arquivo: File, produtos: ProdutoIndice[]): Promise<LinhaMaster[]> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await arquivo.arrayBuffer());
  const ws = wb.worksheets[0];
  if (!ws) throw new Error("Planilha vazia.");

  // Acha a linha de cabeçalho (procura nas 10 primeiras)
  let linhaCab = 0;
  const idx: Partial<Record<keyof LinhaPlanilhaMaster, number>> = {};
  for (let r = 1; r <= Math.min(10, ws.rowCount) && !linhaCab; r++) {
    const row = ws.getRow(r);
    const nomes = new Map<string, number>();
    row.eachCell((c, col) => nomes.set(normalizar(String(valorCelula(c.value) ?? "")).trim(), col));
    if (nomes.has("ID") && nomes.has("REFERENCIA")) {
      linhaCab = r;
      for (const [k, nome] of Object.entries(COLUNAS)) idx[k as keyof LinhaPlanilhaMaster] = nomes.get(nome);
    }
  }
  const faltando = Object.entries(COLUNAS).filter(([k]) => !idx[k as keyof LinhaPlanilhaMaster]).map(([, n]) => n);
  if (!linhaCab || faltando.length) throw new Error(`Colunas não encontradas: ${faltando.join(", ") || "ID, REFERÊNCIA"}.`);

  const existentes = new Set<string>();
  for (const p of produtos) for (const v of p.variantes) existentes.add(normalizar(v.codigoComposto));
  const existe = (c: string) => existentes.has(normalizar(c));

  const out: LinhaMaster[] = [];
  for (let r = linhaCab + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const get = (k: keyof LinhaPlanilhaMaster) => valorCelula(row.getCell(idx[k]!).value);
    const id = String(get("codigo_xbz") ?? "").trim();
    const ref = String(get("referencia") ?? "").trim();
    if (!id && !ref) continue;
    out.push(classificarLinhaMaster({
      codigo_xbz: id, referencia: ref, descricao: (get("descricao") as string) ?? null,
      qtd_por_caixa: get("qtd_por_caixa"), largura_cm: get("largura_cm"),
      altura_cm: get("altura_cm"), comprimento_cm: get("comprimento_cm"),
    }, existe));
  }
  if (!out.length) throw new Error("Nenhuma linha encontrada.");
  return out;
}

export async function gravarPlanilhaMaster(linhas: LinhaMaster[]): Promise<number> {
  const { data, error } = await db.rpc("importar_caixa_master", { linhas });
  if (error) throw new Error(error.message);
  return data as number;
}

export interface LinhaRevisar {
  codigo_xbz: string;
  referencia: string;
  descricao: string | null;
  qtd_por_caixa: number | null;
  largura_cm: number | null;
  altura_cm: number | null;
  comprimento_cm: number | null;
  motivo_revisao: string | null;
}

export async function carregarRevisar(): Promise<LinhaRevisar[]> {
  const { data, error } = await db.from("xbz_caixa_master")
    .select("codigo_xbz, referencia, descricao, qtd_por_caixa, largura_cm, altura_cm, comprimento_cm, motivo_revisao")
    .eq("status_revisao", "revisar").order("referencia").limit(500);
  if (error) throw new Error(error.message);
  return data as LinhaRevisar[];
}
