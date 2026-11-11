import type { ItemDespacho } from "./calibracao";
import { normalizar } from "./regras";

/* Importação em lote do histórico antigo (CSV ou .xlsx). Uma linha por item;
   linhas com o mesmo valor em DESPACHO formam um despacho com vários SKUs. */

export const COLUNAS_HISTORICO = [
  "despacho", "data", "pedido", "largura_cm", "comprimento_cm", "altura_cm",
  "peso_real_kg", "ocupacao_pct", "codigo", "qtd", "observacao",
] as const;

export function modeloCsv(): string {
  const linhas = [
    COLUNAS_HISTORICO.join(";"),
    "1;15/10/2026;PED-1234;60;40;40;18,4;100;01116;50;caixa cheia",
    "2;16/10/2026;PED-1240;60;40;40;12,1;80;00001;500;",
    "2;16/10/2026;PED-1240;60;40;40;12,1;80;10078-AZU;20;mesma caixa, dois produtos",
  ];
  return "\uFEFF" + linhas.join("\r\n") + "\r\n";
}

/** CSV simples (separador ; ou , detectado pelo cabeçalho, aspas duplas). */
export function lerCsv(texto: string): string[][] {
  const t = texto.replace(/^\uFEFF/, "");
  const primeira = t.split(/\r?\n/, 1)[0] ?? "";
  const sep = (primeira.match(/;/g)?.length ?? 0) >= (primeira.match(/,/g)?.length ?? 0) ? ";" : ",";
  const out: string[][] = [];
  let linha: string[] = [], campo = "", aspas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c === '"' && t[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) { linha.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      linha.push(campo); campo = "";
      if (linha.some((x) => x.trim())) out.push(linha);
      linha = [];
    } else campo += c;
  }
  linha.push(campo);
  if (linha.some((x) => x.trim())) out.push(linha);
  return out;
}

const num = (s: string | undefined) => {
  const t = (s ?? "").trim();
  if (!t) return null;
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) ? n : null;
};

/** dd/mm/aaaa, aaaa-mm-dd ou número de série do Excel → aaaa-mm-dd. */
export function lerData(s: string | undefined): string | null {
  const t = (s ?? "").trim();
  let m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const ano = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${ano}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const serie = Number(t);
  if (Number.isFinite(serie) && serie > 20000 && serie < 80000) {
    return new Date(Date.UTC(1899, 11, 30) + serie * 86400000).toISOString().slice(0, 10);
  }
  return null;
}

export interface NovoDespacho {
  chave: string;
  data: string;
  referencia_pedido: string | null;
  caixa_larg_cm: number;
  caixa_comp_cm: number;
  caixa_alt_cm: number;
  peso_real_kg: number;
  ocupacao_pct: number;
  observacao: string | null;
  itens: (ItemDespacho & { codigo_composto: string | null })[];
}

export function montarDespachos(
  linhas: string[][],
  resolverCodigo: (codigo: string) => { codigo_amigavel: string; codigo_composto: string | null } | null,
): { despachos: NovoDespacho[]; erros: string[] } {
  const erros: string[] = [];
  if (!linhas.length) return { despachos: [], erros: ["Arquivo vazio."] };
  const cab = linhas[0].map((c) => normalizar(c).trim().toLowerCase().replace(/\s+/g, "_"));
  const idx = Object.fromEntries(COLUNAS_HISTORICO.map((c) => [c, cab.indexOf(c)])) as Record<(typeof COLUNAS_HISTORICO)[number], number>;
  const faltando = (["data", "largura_cm", "comprimento_cm", "altura_cm", "peso_real_kg", "codigo", "qtd"] as const).filter((c) => idx[c] < 0);
  if (faltando.length) return { despachos: [], erros: [`Colunas não encontradas: ${faltando.join(", ")}. Use o modelo.`] };

  const grupos = new Map<string, NovoDespacho>();
  linhas.slice(1).forEach((l, i) => {
    const n = i + 2;
    const g = (c: (typeof COLUNAS_HISTORICO)[number]) => (idx[c] >= 0 ? (l[idx[c]] ?? "").trim() : "");
    const codigoTxt = g("codigo");
    const qtd = num(g("qtd"));
    const cod = codigoTxt ? resolverCodigo(codigoTxt) : null;
    if (!cod) { erros.push(`Linha ${n}: código "${codigoTxt}" não encontrado.`); return; }
    if (!qtd || qtd <= 0 || !Number.isInteger(qtd)) { erros.push(`Linha ${n}: quantidade inválida.`); return; }
    const chave = g("despacho") || `linha-${n}`;
    const item = { codigo_amigavel: cod.codigo_amigavel, codigo_composto: cod.codigo_composto, qtd };
    const existente = grupos.get(chave);
    if (existente) { existente.itens.push(item); return; }
    const data = lerData(g("data"));
    const L = num(g("largura_cm")), C = num(g("comprimento_cm")), A = num(g("altura_cm"));
    const peso = num(g("peso_real_kg"));
    const ocup = num(g("ocupacao_pct")) ?? 100;
    if (!data) { erros.push(`Linha ${n}: data inválida (use dd/mm/aaaa).`); return; }
    if (!L || !C || !A || L <= 0 || C <= 0 || A <= 0) { erros.push(`Linha ${n}: dimensões da caixa inválidas.`); return; }
    if (!peso || peso <= 0) { erros.push(`Linha ${n}: peso real inválido.`); return; }
    if (ocup <= 0 || ocup > 100) { erros.push(`Linha ${n}: ocupação deve estar entre 1 e 100.`); return; }
    grupos.set(chave, {
      chave, data, referencia_pedido: g("pedido") || null,
      caixa_larg_cm: L, caixa_comp_cm: C, caixa_alt_cm: A, peso_real_kg: peso, ocupacao_pct: ocup,
      observacao: g("observacao") || null, itens: [item],
    });
  });
  return { despachos: [...grupos.values()], erros };
}

/** Lê .csv ou .xlsx (primeira aba) como matriz de texto. */
export async function lerArquivoHistorico(arquivo: File): Promise<string[][]> {
  if (/\.csv$/i.test(arquivo.name) || arquivo.type === "text/csv") return lerCsv(await arquivo.text());
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await arquivo.arrayBuffer());
  const ws = wb.worksheets[0];
  const out: string[][] = [];
  ws?.eachRow((row) => {
    const vals: string[] = [];
    for (let c = 1; c <= ws.columnCount; c++) {
      const v = row.getCell(c).value as unknown;
      if (v instanceof Date) vals.push(v.toISOString().slice(0, 10));
      else if (v && typeof v === "object" && "result" in v) vals.push(String((v as { result: unknown }).result ?? ""));
      else if (v && typeof v === "object" && "text" in v) vals.push(String((v as { text: unknown }).text ?? ""));
      else if (typeof v === "number") vals.push(String(v).replace(".", ","));
      else vals.push(v === null || v === undefined ? "" : String(v));
    }
    out.push(vals);
  });
  return out;
}
