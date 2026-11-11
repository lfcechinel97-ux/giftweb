/* Regras de texto e de dados que valem para a calculadora inteira. */

/** Maiúsculas, sem acento: "Boné térmico" → "BONE TERMICO". */
export const normalizar = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

const temPalavra = (nome: string, palavras: string[]) => {
  const n = normalizar(nome);
  return palavras.some((p) => new RegExp(`(^|[^A-Z0-9])${p}([^A-Z0-9]|$)`).test(n));
};

/** Itens cilíndricos: se faltar só a profundidade, ela é igual à largura (diâmetro). */
export const PALAVRAS_CILINDRICO = ["CANETA", "LAPIS", "COPO", "GARRAFA", "SQUEEZE", "CANECA", "CANTIL", "TUBO"];
export const ehCilindrico = (nome: string) => temPalavra(nome, PALAVRAS_CILINDRICO);

/** Itens que a API pode medir abertos (mochila, bolsa…). */
export const PALAVRAS_DOBRAVEL = [
  "MOCHILA", "BOLSA", "NECESSAIRE", "ESTOJO", "SACOLA", "ECOBAG", "SHOPPING BAG", "CAMISETA",
  "BONE", "TOALHA", "GUARDA-CHUVA", "AVENTAL", "PASTA", "MALA", "CAPA",
];
export const ehDobravel = (nome: string) => temPalavra(nome, PALAVRAS_DOBRAVEL);

/** Medida da API: 0, negativo, vazio ou lixo = ausente. Nunca vira medida. */
export function medida(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** "#10078#-AZU" → "10078-AZU" (casa com CodigoComposto). */
export const normalizarReferencia = (ref: string) => ref.replace(/#/g, "").trim().toUpperCase();

export function mediana(valores: number[]): number | null {
  if (!valores.length) return null;
  const v = [...valores].sort((a, b) => a - b);
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/** Folga numérica para divisões que deveriam dar inteiro exato. */
export const EPS = 1e-9;
