import { jsPDF } from "jspdf";

/* Pedido de compra em A4 retrato, para a expedição conferir o que chegou.
   Com ou sem preço; a coluna "Conf." é o quadrado que a expedição marca. */

export interface LinhaPedidoCompra {
  produto: string;
  sku?: string | null;
  variacao?: string | null;
  foto?: string | null;
  pedido?: string | null;
  cliente?: string | null;
  quantidade: number;
  valorUnitario?: number | null;
}

export interface DadosPedidoCompra {
  numero: number;
  data: string; // ISO
  fornecedor: string;
  criadoPor?: string | null;
  linhas: LinhaPedidoCompra[];
  comPreco: boolean;
}

const AZUL = [20, 100, 210] as const;
const AZUL_ESCURO = [16, 42, 86] as const;
const CINZA = [245, 247, 250] as const;
const BORDA = [217, 224, 232] as const;
const TEXTO = [23, 32, 51] as const;
const FRACO = [110, 122, 140] as const;

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

async function carregarImagem(src: string): Promise<string | null> {
  try {
    const controle = new AbortController();
    const limite = setTimeout(() => controle.abort(), 8000);
    const res = await fetch(src, { mode: "cors", signal: controle.signal });
    clearTimeout(limite);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  } catch { return null; }
}

export async function gerarPedidoCompraPDF(d: DadosPedidoCompra) {
  const fotos = await Promise.all(d.linhas.map(l => (l.foto ? carregarImagem(l.foto) : Promise.resolve(null))));
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const L = 595, A = 842, M = 36;
  const largura = L - M * 2;

  // Colunas [x inicial, largura]
  const cols: Record<"n" | "prod" | "ped" | "qtd" | "un" | "tot" | "conf", [number, number]> = d.comPreco
    ? { n: [M, 24], prod: [M + 24, 200], ped: [M + 224, 90], qtd: [M + 314, 50], un: [M + 364, 66], tot: [M + 430, 66], conf: [M + 496, 27] }
    : { n: [M, 26], prod: [M + 26, 250], ped: [M + 276, 120], qtd: [M + 396, 60], un: [0, 0], tot: [0, 0], conf: [M + 456, 67] };

  const cabecalho = () => {
    doc.setFillColor(...AZUL);
    doc.rect(0, 0, L, 62, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("PEDIDO DE COMPRA", M, 30);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(`Nº ${String(d.numero).padStart(4, "0")}`, M, 48);
    doc.text(new Date(d.data).toLocaleDateString("pt-BR"), L - M, 30, { align: "right" });
    doc.text(d.comPreco ? "Com preços" : "Sem preços", L - M, 48, { align: "right" });

    doc.setTextColor(...TEXTO);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(`Fornecedor: ${d.fornecedor}`, M, 86);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...FRACO);
    if (d.criadoPor) doc.text(`Comprado por ${d.criadoPor}`, M, 100);
  };

  const cabecalhoTabela = (y: number) => {
    doc.setFillColor(...AZUL_ESCURO);
    doc.rect(M, y, largura, 20, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    const t = (txt: string, [x, w]: [number, number], alinhar: "left" | "right" | "center" = "left") =>
      doc.text(txt, alinhar === "right" ? x + w - 4 : alinhar === "center" ? x + w / 2 : x + 4, y + 13, { align: alinhar });
    t("#", cols.n);
    t("PRODUTO", cols.prod);
    t("PEDIDO / CLIENTE", cols.ped);
    t("QTD", cols.qtd, "right");
    if (d.comPreco) { t("UNIT.", cols.un, "right"); t("TOTAL", cols.tot, "right"); }
    t("CONF.", cols.conf, "center");
    return y + 20;
  };

  cabecalho();
  let y = cabecalhoTabela(116);
  let total = 0;
  let unidades = 0;

  d.linhas.forEach((l, i) => {
    const FOTO = 34;
    const foto = fotos[i];
    const larguraNome = cols.prod[1] - 8 - FOTO - 6;
    const nomeLinhas = doc.splitTextToSize(l.produto, larguraNome) as string[];
    const detalhe = [l.sku ? `SKU ${l.sku}` : "", l.variacao ? `Cor/variação: ${l.variacao}` : ""].filter(Boolean);
    const detLinhas = detalhe.flatMap(t => doc.splitTextToSize(t, larguraNome) as string[]);
    const ref = [l.pedido ? `#${l.pedido}` : "", l.cliente ?? ""].filter(Boolean).join(" · ");
    const refLinhas = doc.splitTextToSize(ref, cols.ped[1] - 8) as string[];
    const nLinhas = Math.max(nomeLinhas.length + detLinhas.length, refLinhas.length, 1);
    const h = Math.max(FOTO + 10, nLinhas * 11 + 10);

    if (y + h > A - 90) {
      doc.addPage();
      cabecalho();
      y = cabecalhoTabela(116);
    }

    if (i % 2 === 0) { doc.setFillColor(...CINZA); doc.rect(M, y, largura, h, "F"); }
    doc.setDrawColor(...BORDA);
    doc.line(M, y + h, M + largura, y + h);

    doc.setTextColor(...TEXTO);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(String(i + 1), cols.n[0] + 4, y + 16);
    if (foto) {
      try {
        const pr = doc.getImageProperties(foto);
        const esc = Math.min(FOTO / pr.width, FOTO / pr.height);
        const w = pr.width * esc, hh = pr.height * esc;
        doc.addImage(foto, cols.prod[0] + 4 + (FOTO - w) / 2, y + 5 + (FOTO - hh) / 2, w, hh, undefined, "FAST");
      } catch { /* imagem inválida: segue sem foto */ }
    }
    const xNome = cols.prod[0] + 4 + FOTO + 6;
    doc.setFont("helvetica", "bold");
    doc.text(nomeLinhas, xNome, y + 16);
    if (detLinhas.length) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...FRACO);
      doc.text(detLinhas, xNome, y + 16 + nomeLinhas.length * 11);
      doc.setFontSize(9);
      doc.setTextColor(...TEXTO);
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...FRACO);
    doc.text(refLinhas, cols.ped[0] + 4, y + 16);
    doc.setTextColor(...TEXTO);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(num(l.quantidade), cols.qtd[0] + cols.qtd[1] - 4, y + 17, { align: "right" });
    unidades += l.quantidade;

    if (d.comPreco) {
      const un = l.valorUnitario ?? 0;
      const sub = un * l.quantidade;
      total += sub;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(brl(un), cols.un[0] + cols.un[1] - 4, y + 16, { align: "right" });
      doc.setFont("helvetica", "bold");
      doc.text(brl(sub), cols.tot[0] + cols.tot[1] - 4, y + 16, { align: "right" });
    }

    doc.setDrawColor(...FRACO);
    doc.rect(cols.conf[0] + cols.conf[1] / 2 - 6, y + 7, 12, 12);
    y += h;
  });

  // Rodapé: totais e assinatura
  if (y + 90 > A - 40) { doc.addPage(); cabecalho(); y = 116; }
  y += 14;
  doc.setTextColor(...TEXTO);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Total de unidades: ${num(unidades)}`, M, y);
  if (d.comPreco) doc.text(`Total: ${brl(total)}`, L - M, y, { align: "right" });

  y += 46;
  doc.setDrawColor(...FRACO);
  doc.line(M, y, M + 230, y);
  doc.line(L - M - 150, y, L - M, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...FRACO);
  doc.text("Conferido por (expedição)", M, y + 12);
  doc.text("Data", L - M - 150, y + 12);

  doc.save(`pedido-de-compra-${String(d.numero).padStart(4, "0")}${d.comPreco ? "-com-preco" : ""}.pdf`);
}
