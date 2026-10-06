/* Geração da cartela de DTF em PDF vetorial, 100% no navegador (pdf-lib).
   Camada base: a página da logo incorporada como Form XObject (embedPage),
   intacta. Camada TOYO (DTF UV): segundo Form XObject por cima, todo no
   spot Separation a 100% com overprint, por troca de cor ou contraído. */

import {
  PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFRawStream, PDFStream,
  EncryptedPDFError, concatTransformationMatrix, decodePDFRawStream, drawObject,
  popGraphicsState, pushGraphicsState,
} from "pdf-lib";
import { CM, LIMITE_COMPRIMENTO_CM, ErroCartela, calcularLayout, nomeArquivo, type CaixaLogo, type Layout, type ParametrosLayout } from "./layout";
import { avisosTrocaDeCor, bytesParaLatin1, latin1ParaBytes, trocarCoresPorSpot } from "./conteudoPdf";
import { interpretar, type ExtGState, type Matriz, type Recursos, type ResultadoGeometria, type XObject } from "./geometria";
import { contrairSilhueta, type ResultadoContracao } from "./contracao";

export const SPOT_PADRAO = "TOYO 0001pc";
export const CMYK_PADRAO: [number, number, number, number] = [33, 90, 3, 0];
/** Distância padrão da contração do TOYO (mm, no tamanho impresso). */
export const DISTANCIA_PADRAO_MM = 0.15;
/** Tolerância de achatamento das curvas na contração (mm, tamanho impresso). */
const TOLERANCIA_CURVA_MM = 0.005;

const ERRO_VETORIAL = "envie um PDF vetorial exportado do Corel/Illustrator.";

export type Modo = "textil" | "uv";

export interface OpcoesCartela extends ParametrosLayout {
  modo: Modo;
  contrair: boolean;
  distanciaMm: number;
  spot: string;
  cmyk: [number, number, number, number];
}

export interface Cartela {
  pdf: Uint8Array;
  nome: string;
  layout: Layout;
  avisos: string[];
  contracao: ResultadoContracao | null;
}

export interface InfoLogo {
  caixa: CaixaLogo;
}

/* ------------------------------------------------------------ leitura */

const decodificar = (s: PDFStream): Uint8Array => {
  if (s instanceof PDFRawStream) return decodePDFRawStream(s).decode();
  const qualquer = s as unknown as { getUnencodedContents?: () => Uint8Array; getContents: () => Uint8Array };
  return qualquer.getUnencodedContents ? qualquer.getUnencodedContents() : qualquer.getContents();
};

const numeros = (arr: PDFArray | undefined) => {
  if (!arr) return null;
  const out: number[] = [];
  for (let i = 0; i < arr.size(); i++) {
    const v = arr.lookup(i);
    out.push(v instanceof PDFNumber ? v.asNumber() : 0);
  }
  return out;
};

/** Recursos da página para o interpretador geométrico. */
function recursosDe(dict: PDFDict | undefined): Recursos {
  const sub = (chave: string) => dict?.lookupMaybe(PDFName.of(chave), PDFDict);
  return {
    xobject(nome): XObject {
      const s = sub("XObject")?.lookup(PDFName.of(nome));
      if (!(s instanceof PDFStream)) return null;
      const tipo = s.dict.lookup(PDFName.of("Subtype"));
      if (tipo === PDFName.of("Image")) return { tipo: "imagem" };
      if (tipo !== PDFName.of("Form")) return null;
      const m = numeros(s.dict.lookupMaybe(PDFName.of("Matrix"), PDFArray));
      const bb = numeros(s.dict.lookupMaybe(PDFName.of("BBox"), PDFArray));
      return {
        tipo: "form",
        conteudo: bytesParaLatin1(decodificar(s)),
        matriz: (m && m.length === 6 ? m : [1, 0, 0, 1, 0, 0]) as Matriz,
        bbox: bb && bb.length === 4 ? [Math.min(bb[0], bb[2]), Math.min(bb[1], bb[3]), Math.max(bb[0], bb[2]), Math.max(bb[1], bb[3])] : null,
        recursos: recursosDe(s.dict.lookupMaybe(PDFName.of("Resources"), PDFDict) ?? dict),
      };
    },
    extgstate(nome): ExtGState | null {
      const g = sub("ExtGState")?.lookupMaybe(PDFName.of(nome), PDFDict);
      if (!g) return null;
      const n = (k: string) => g.lookupMaybe(PDFName.of(k), PDFNumber)?.asNumber();
      const d = g.lookupMaybe(PDFName.of("D"), PDFArray);
      const tracos = d ? numeros(d.lookupMaybe(0, PDFArray)) : null;
      return { LW: n("LW"), LC: n("LC"), LJ: n("LJ"), ML: n("ML"), tracejado: tracos ? tracos.some((v) => v > 0) : undefined };
    },
  };
}

async function abrirPdf(bytes: Uint8Array) {
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes, { updateMetadata: false });
  } catch (e) {
    if (e instanceof EncryptedPDFError) throw new ErroCartela(`O PDF está protegido por senha: ${ERRO_VETORIAL}`);
    throw new ErroCartela(`Não foi possível ler o arquivo como PDF: ${ERRO_VETORIAL}`);
  }
  if (doc.isEncrypted) throw new ErroCartela(`O PDF está protegido por senha: ${ERRO_VETORIAL}`);
  if (doc.getPageCount() === 0) throw new ErroCartela(`O PDF não tem nenhuma página: ${ERRO_VETORIAL}`);
  const pagina = doc.getPage(0);
  const mb = pagina.getMediaBox();
  if (!(mb.width > 0 && mb.height > 0)) throw new ErroCartela(`A página 1 do PDF não tem tamanho válido: ${ERRO_VETORIAL}`);
  const caixa: CaixaLogo = { left: mb.x, bottom: mb.y, width: mb.width, height: mb.height };
  return { doc, pagina, caixa };
}

function conteudoDaPagina(pagina: ReturnType<PDFDocument["getPage"]>): string {
  const { Contents } = pagina.node.normalizedEntries();
  if (!Contents) return "";
  const partes: string[] = [];
  for (let i = 0; i < Contents.size(); i++) {
    const s = Contents.lookup(i, PDFStream);
    partes.push(bytesParaLatin1(decodificar(s)));
  }
  return partes.join("\n");
}

/**
 * Lê a logo e confere se é vetorial. Lança ErroCartela com mensagem em
 * português se o PDF não tiver página, estiver protegido ou for só imagem.
 */
export async function lerLogo(bytes: Uint8Array): Promise<InfoLogo> {
  const { pagina, caixa } = await abrirPdf(bytes);
  const conteudo = conteudoDaPagina(pagina);
  const geo = interpretar(conteudo, recursosDe(pagina.node.normalizedEntries().Resources), Math.max(caixa.width, caixa.height) / 500);
  if (geo.pinturas.length === 0 && !geo.temTexto) {
    throw new ErroCartela(
      geo.temImagem || geo.temGradiente
        ? `O PDF tem só imagem, sem desenho vetorial: ${ERRO_VETORIAL}`
        : `A página 1 do PDF está vazia: ${ERRO_VETORIAL}`,
    );
  }
  return { caixa };
}

/* ------------------------------------------------------------ geração */

// a contração só depende da logo, da largura e da distância: muda a
// quantidade/espaçamento e o resultado é reaproveitado
let cacheContracao: { bytes: Uint8Array; chave: string; geo: ResultadoGeometria; r: ResultadoContracao } | null = null;

export async function gerarCartela(bytes: Uint8Array, o: OpcoesCartela): Promise<Cartela> {
  const { pagina, caixa } = await abrirPdf(bytes);
  const layout = calcularLayout(caixa, o);
  const avisos: string[] = [];
  const toyo = o.modo === "uv";

  const out = await PDFDocument.create({ updateMetadata: false });
  out.setProducer("Gift Web Brindes - Cartela DTF");
  out.setCreator("giftwebbrindes.com.br/carteladtf");
  const folha = out.addPage([layout.larguraFolha, layout.alturaFolha]);

  // BBox com a origem real do MediaBox: o padrão do pdf-lib assume 0 0 e
  // cortaria/deslocaria as logos do Corel (origem -1 -1)
  const { left: x0, bottom: y0, width: w, height: h } = caixa;
  const base = await out.embedPage(pagina, { left: x0, bottom: y0, right: x0 + w, top: y0 + h });
  await base.embed();

  let nomeToyo: PDFName | null = null;
  let contracao: ResultadoContracao | null = null;
  if (toyo) {
    const ctx = out.context;
    const formBase = ctx.lookup(base.ref) as PDFRawStream;
    const conteudoBase = bytesParaLatin1(decodePDFRawStream(formBase).decode());
    const recursosBase = formBase.dict.lookupMaybe(PDFName.of("Resources"), PDFDict);

    const tint = ctx.obj({
      FunctionType: 2, Domain: [0, 1], C0: [0, 0, 0, 0], C1: o.cmyk.map((v) => v / 100), N: 1,
    });
    const separation = ctx.obj([PDFName.of("Separation"), PDFName.of(o.spot), PDFName.of("DeviceCMYK"), tint]);
    const gsOp = ctx.obj({ Type: "ExtGState", op: true, OP: true, OPM: 1 });

    let conteudo: string;
    let recursos: PDFDict;
    if (o.contrair) {
      const chave = `${o.larguraCm}|${o.distanciaMm}`;
      let geo: ResultadoGeometria;
      if (cacheContracao && cacheContracao.bytes === bytes && cacheContracao.chave === chave) {
        geo = cacheContracao.geo;
        contracao = cacheContracao.r;
      } else {
        const tol = (TOLERANCIA_CURVA_MM / 10) * CM / layout.escala;
        geo = interpretar(conteudoBase, recursosDe(recursosBase), tol);
        contracao = await contrairSilhueta(geo.pinturas, layout.escala, o.distanciaMm);
        cacheContracao = { bytes, chave, geo, r: contracao };
      }
      if (geo.temTexto) avisos.push("A logo tem texto não convertido em curvas: o texto fica sem TOYO na contração. Converta o texto em curvas no Corel/Illustrator.");
      if (geo.temImagem) avisos.push("A logo tem imagem: a imagem fica sem TOYO na contração.");
      if (geo.temGradiente) avisos.push("A logo tem gradiente (shading): essa parte fica sem TOYO na contração.");
      if (geo.temTracejado) avisos.push("A logo tem linha tracejada: na contração ela foi tratada como linha contínua.");
      if (contracao.vazio || contracao.perdeuPartesFinas) avisos.push("Algumas partes finas da logo ficaram sem TOYO com essa distância.");
      conteudo = "/GSop gs\n/CSspot cs 1 scn\n" + contracao.caminhos;
      recursos = ctx.obj({ ColorSpace: { CSspot: separation }, ExtGState: { GSop: gsOp } });
    } else {
      avisos.push(...avisosTrocaDeCor(conteudoBase));
      conteudo = trocarCoresPorSpot(conteudoBase);
      recursos = recursosBase ? recursosBase.clone(ctx) : ctx.obj({});
      const copiar = (chave: string) => {
        const novo = ctx.obj({});
        const antigo = recursos.lookupMaybe(PDFName.of(chave), PDFDict);
        antigo?.entries().forEach(([k, v]) => novo.set(k, v));
        recursos.set(PDFName.of(chave), novo);
        return novo;
      };
      copiar("ColorSpace").set(PDFName.of("CSspot"), separation);
      copiar("ExtGState").set(PDFName.of("GSop"), gsOp);
    }

    const formToyo = ctx.flateStream(latin1ParaBytes(conteudo), {
      Type: "XObject", Subtype: "Form", FormType: 1,
      BBox: [x0, y0, x0 + w, y0 + h], Matrix: [1, 0, 0, 1, -x0, -y0], Resources: recursos,
    });
    nomeToyo = folha.node.newXObject("FmT", ctx.register(formToyo));
  }

  // um nome de recurso só para a base (o drawPage do pdf-lib cria um por cópia);
  // cada cópia: q  s 0 0 s x y cm  /Fm Do  Q -- o /Matrix do form já desconta a origem
  const nomeBase = folha.node.newXObject("FmB", base.ref);
  const s = layout.escala;
  const desenhar = (nome: PDFName, x: number, y: number) =>
    folha.pushOperators(pushGraphicsState(), concatTransformationMatrix(s, 0, 0, s, x, y), drawObject(nome), popGraphicsState());
  for (const { x, y } of layout.posicoes) {
    desenhar(nomeBase, x, y);
    if (nomeToyo) desenhar(nomeToyo, x, y); // TOYO sempre por cima da original
  }

  const comprimentoCm = layout.alturaFolha / CM;
  if (comprimentoCm > LIMITE_COMPRIMENTO_CM) {
    avisos.push(`A folha ficou com ${(comprimentoCm / 100).toFixed(2).replace(".", ",")} m de comprimento, acima de 5 m: muitos RIPs não abrem PDFs tão longos. Considere dividir em mais de uma cartela.`);
  }

  const pdf = await out.save({ useObjectStreams: false });
  return { pdf, nome: nomeArquivo(o.qtd, o.larguraCm, toyo), layout, avisos, contracao };
}
