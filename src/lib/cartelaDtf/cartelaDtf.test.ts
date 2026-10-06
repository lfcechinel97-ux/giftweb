import { describe, expect, it } from "vitest";
import { PDFContentStream, PDFDocument, PDFName, PDFDict, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import { CM, calcularLayout, calcularLayoutCartela, lerNumero, nomeArquivo } from "./layout";
import { bytesParaLatin1, trocarCoresPorSpot } from "./conteudoPdf";
import { gerarCartela, lerLogo, CMYK_PADRAO, SPOT_PADRAO, type OpcoesCartela } from "./gerarCartela";

/** PDF mínimo "estilo Corel": MediaBox com origem -1 -1 e /GS0 com op false. */
function pdfTeste(conteudo: string, mediaBox = "[-1 -1 380.67 368.15]") {
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox ${mediaBox} /Contents 4 0 R /Resources << /ExtGState << /GS0 << /op false /OP false >> >> >> >>`,
    `<< /Length ${conteudo.length} >>\nstream\n${conteudo}\nendstream`,
  ];
  let s = "%PDF-1.5\n";
  const offs: number[] = [];
  objs.forEach((o, i) => { offs.push(s.length); s += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = s.length;
  s += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  s += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array([...s].map((c) => c.charCodeAt(0)));
}

const QUADRADO = "/GS0 gs 0 0.8 1 0 k 10 10 300 300 re f 0.2 0.3 0.9 rg 50 50 m 100 50 l 100 100 l h f";
type Teste = OpcoesCartela & { larguraCm: number; qtd: number };
const opcoes = (o: Partial<Teste> = {}): Teste => ({
  larguraCm: 7, qtd: 30, espacoCm: 1, folhaMaxCm: 57, margemCm: 0.5, distribuicao: "equilibrada",
  modo: "uv", contrair: false, distanciaMm: 0.15, spot: SPOT_PADRAO, cmyk: CMYK_PADRAO, ...o,
});

const gerar = (bytes: Uint8Array, o: Teste) => gerarCartela([{ bytes, larguraCm: o.larguraCm, qtd: o.qtd }], o);

async function formToyo(pdf: Uint8Array) {
  const doc = await PDFDocument.load(pdf);
  const xo = doc.getPage(0).node.Resources()!.lookup(PDFName.of("XObject"), PDFDict);
  const chave = xo.keys().find((k) => k.asString().startsWith("/FmT"))!;
  const s = xo.lookup(chave) as PDFRawStream;
  return { dict: s.dict, conteudo: bytesParaLatin1(decodePDFRawStream(s).decode()) };
}

describe("layout da cartela", () => {
  const caixa = { left: -1, bottom: -1, width: 381.67, height: 369.15 };

  it("caso de teste obrigatório: 7 cm, 30 un. -> 6 × 5, folha 48,00 × 38,85 cm", () => {
    const L = calcularLayout(caixa, opcoes());
    expect([L.cols, L.linhas]).toEqual([6, 5]);
    expect((L.larguraFolha / CM).toFixed(2)).toBe("48.00");
    expect((L.alturaFolha / CM).toFixed(2)).toBe("38.85");
    expect((L.H / CM).toFixed(2)).toBe("6.77");
    expect(L.posicoes[7].x).toBeCloseTo(0.5 * CM + 8 * CM, 6);
  });

  it("logo larga (20 cm, 5 un.) e encher linha", () => {
    const L = calcularLayout(caixa, opcoes({ larguraCm: 20, qtd: 5 }));
    expect([L.cols, L.linhas]).toEqual([2, 3]);
    const C = calcularLayout(caixa, opcoes({ qtd: 13, distribuicao: "encher" }));
    expect([C.cols, C.linhas]).toEqual([7, 2]);
  });

  it("erro quando não cabe na folha", () => {
    expect(() => calcularLayout(caixa, opcoes({ larguraCm: 60 }))).toThrow("não cabe");
  });

  it("várias logos: cada uma no seu bloco, uma embaixo da outra", () => {
    const outra = { left: 0, bottom: 0, width: 200, height: 100 };
    const L = calcularLayoutCartela(
      [{ caixa, larguraCm: 7, qtd: 30 }, { caixa: outra, larguraCm: 20, qtd: 3 }],
      opcoes(),
    );
    const [a, b] = L.itens;
    expect([a.cols, a.linhas, b.cols, b.linhas]).toEqual([6, 5, 2, 2]);
    // folha = bloco mais largo; altura = blocos + espaçamento entre eles
    expect((L.larguraFolha / CM).toFixed(2)).toBe("48.00");
    expect(L.alturaFolha / CM).toBeCloseTo(0.5 + 5 * a.H / CM + 4 + 1 + 2 * b.H / CM + 1 + 0.5, 6);
    // primeira logo do segundo bloco: um espaçamento abaixo da última linha do primeiro
    const ultimaA = a.posicoes[a.posicoes.length - 1].y;
    expect(ultimaA - (b.posicoes[0].y + b.H)).toBeCloseTo(1 * CM, 6);
    expect(b.posicoes[0].x).toBeCloseTo(0.5 * CM, 6);
    // uma logo só continua idêntico à referência
    expect(calcularLayoutCartela([{ caixa, larguraCm: 7, qtd: 30 }], opcoes()).itens[0].posicoes)
      .toEqual(calcularLayout(caixa, opcoes()).posicoes);
    expect(() => calcularLayoutCartela([{ caixa, larguraCm: 7, qtd: 1 }, { caixa, larguraCm: 80, qtd: 1 }], opcoes()))
      .toThrow("A logo 2 não cabe");
  });

  it("nome do arquivo e números com vírgula", () => {
    expect(nomeArquivo(30, 7, true)).toBe("cartela_30x_7cm_toyo.pdf");
    expect(nomeArquivo(5, 6.5, false)).toBe("cartela_5x_6.5cm.pdf");
    expect(nomeArquivo(45, 7, true, 3)).toBe("cartela_45x_3logos_toyo.pdf");
    expect(lerNumero("0,15")).toBe(0.15);
    expect(lerNumero("0.2")).toBe(0.2);
    expect(lerNumero("abc")).toBeNaN();
  });
});

describe("troca de cor pelo spot", () => {
  it("troca CMYK, RGB, cinza e espaço nomeado e reaplica o overprint", () => {
    const c = trocarCoresPorSpot("/GS0 gs 0 0 0 1 k 1 0 0 RG 0.5 g .2 G /CS0 cs 0.3 scn /CS1 CS 1 0.5 SCN");
    expect(c).not.toMatch(/\b(k|K|rg|RG|g|G)\b/);
    expect(c).toContain("/GS0 gs /GSop gs");
    expect(c.startsWith("/GSop gs\n/CSspot cs 1 scn\n/CSspot CS 1 SCN\n")).toBe(true);
    expect(c.match(/\/CSspot CS 1 SCN/g)).toHaveLength(4);
  });
});

describe("geração do PDF", () => {
  it("DTF UV: Separation TOYO, overprint e posições com a origem do Corel", async () => {
    const c = await gerar(pdfTeste(QUADRADO), opcoes());
    expect(c.nome).toBe("cartela_30x_7cm_toyo.pdf");
    const texto = bytesParaLatin1(c.pdf);
    expect(texto).toContain("/TOYO#200001pc");
    expect(texto).toMatch(/\/op true/);
    expect(texto).toMatch(/\/OPM 1/);
    expect(texto).not.toContain("/Image");
    const { dict, conteudo } = await formToyo(c.pdf);
    expect(dict.lookup(PDFName.of("Matrix"))!.toString()).toBe("[ 1 0 0 1 1 1 ]");
    expect(conteudo).not.toMatch(/\b(k|rg)\b/);
    // primeira cópia: canto do MediaBox (-1,-1) cai na margem
    const saida = await PDFDocument.load(c.pdf);
    const contents = saida.getPage(0).node.normalizedEntries().Contents!;
    const pagina = Array.from({ length: contents.size() }, (_, i) => {
      const st = saida.context.lookup(contents.get(i));
      return bytesParaLatin1(st instanceof PDFRawStream ? decodePDFRawStream(st).decode() : (st as PDFContentStream).getUnencodedContents());
    }).join("\n");
    expect(pagina).toMatch(/q\n0\.519\d+ 0 0 0\.519\d+ 14\.17\d+ 895\.22\d+ cm\n\/FmB/);
  });

  it("DTF têxtil: só a original", async () => {
    const c = await gerar(pdfTeste(QUADRADO), opcoes({ modo: "textil" }));
    expect(c.nome).toBe("cartela_30x_7cm.pdf");
    expect(bytesParaLatin1(c.pdf)).not.toContain("Separation");
  });

  it("contração: TOYO recuado d mm de cada lado e peças finas avisadas", async () => {
    // quadrado de 300 pt com logo de 7 cm: 300 pt na fonte = 300 * escala na folha
    const conteudo = "0 0 0 1 k 10 10 300 300 re f 10 340 300 0.5 re f";
    const c = await gerar(pdfTeste(conteudo), opcoes({ contrair: true, qtd: 1 }));
    const { conteudo: toyo } = await formToyo(c.pdf);
    expect(toyo.startsWith("/GSop gs\n/CSspot cs 1 scn\n")).toBe(true);
    expect(toyo.trim().endsWith("f*")).toBe(true);
    const xs = [...toyo.matchAll(/([-\d.]+) ([-\d.]+) [ml]\n/g)].map((m) => Number(m[1]));
    const recuoMm = ((Math.min(...xs) - 10) * c.layout.itens[0].escala / CM) * 10;
    expect(recuoMm).toBeCloseTo(0.15, 3);
    expect(c.avisos).toContain("Algumas partes finas da logo ficaram sem TOYO com essa distância.");
  });

  it("a distância é física: igual com a logo em 4 cm e 20 cm", async () => {
    for (const larguraCm of [4, 20]) {
      const c = await gerar(pdfTeste("0 g 10 10 300 300 re f"), opcoes({ contrair: true, qtd: 1, larguraCm, distanciaMm: 0.2 }));
      const { conteudo } = await formToyo(c.pdf);
      const xs = [...conteudo.matchAll(/([-\d.]+) ([-\d.]+) [ml]\n/g)].map((m) => Number(m[1]));
      expect(((Math.min(...xs) - 10) * c.layout.itens[0].escala / CM) * 10).toBeCloseTo(0.2, 3);
    }
  });

  it("várias logos no mesmo PDF, cada uma com a sua camada TOYO", async () => {
    const c = await gerarCartela(
      [
        { bytes: pdfTeste(QUADRADO), larguraCm: 7, qtd: 4 },
        { bytes: pdfTeste("0 0 1 0 k 0 0 100 50 re f", "[0 0 100 50]"), larguraCm: 5, qtd: 6 },
      ],
      opcoes({ contrair: true }),
    );
    expect(c.nome).toBe("cartela_10x_2logos_toyo.pdf");
    expect(c.layout.itens.map((i) => i.posicoes.length)).toEqual([4, 6]);
    expect(c.contracoes.every((x) => x && !x.vazio)).toBe(true);
    const doc = await PDFDocument.load(c.pdf);
    const xo = doc.getPage(0).node.Resources()!.lookup(PDFName.of("XObject"), PDFDict);
    const nomes = xo.keys().map((k) => k.asString());
    expect(nomes.filter((n) => n.startsWith("/FmB"))).toHaveLength(2);
    expect(nomes.filter((n) => n.startsWith("/FmT"))).toHaveLength(2);
    // um único Separation compartilhado pelas duas camadas TOYO
    expect(bytesParaLatin1(c.pdf).match(/\/TOYO#200001pc/g)).toHaveLength(1);
  });

  it("erros de PDF não vetorial", async () => {
    await expect(lerLogo(new Uint8Array([1, 2, 3]))).rejects.toThrow("PDF vetorial");
    await expect(lerLogo(pdfTeste("q 10 0 0 10 0 0 cm Q"))).rejects.toThrow("vazia");
    await expect(lerLogo(pdfTeste("BI /W 1 /H 1 /CS /G /BPC 8 ID \x80 EI"))).rejects.toThrow("só imagem");
  });
});
