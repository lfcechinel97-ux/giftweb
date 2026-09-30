import { jsPDF } from "jspdf";

/* Relatório dos produtos SELECIONADOS na aba "Comprar" (antes de virarem um
   pedido de compra formal): Número pedido / foto mockup / descrição produto /
   cor / quantidade. Dois formatos, os dois disparados do mesmo botão:
   - PDF: para imprimir/anexar.
   - HTML: baixa um arquivo .html com uma <table> de verdade -- colado no
     Excel/Sheets vira células normais, então funciona como "editável" sem
     precisar gerar um .xlsx de fato. */

export interface LinhaRelatorioCompra {
  pedido: string | null;
  cliente: string | null;
  produto: string;
  cor: string | null;
  quantidade: number;
  foto: string | null;
}

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

const AZUL = [20, 100, 210] as const;
const AZUL_ESCURO = [16, 42, 86] as const;
const CINZA = [245, 247, 250] as const;
const BORDA = [217, 224, 232] as const;
const TEXTO = [23, 32, 51] as const;
const FRACO = [110, 122, 140] as const;
const num = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

export async function gerarRelatorioComprasPDF(linhas: LinhaRelatorioCompra[]) {
  const fotos = await Promise.all(linhas.map(l => (l.foto ? carregarImagem(l.foto) : Promise.resolve(null))));
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const L = 595, A = 842, M = 36;
  const largura = L - M * 2;

  const cols: Record<"n" | "prod" | "ped" | "cor" | "qtd", [number, number]> =
    { n: [M, 26], prod: [M + 26, 250], ped: [M + 276, 130], cor: [M + 406, 90], qtd: [M + 496, largura - 460] };

  const cabecalho = () => {
    doc.setFillColor(...AZUL);
    doc.rect(0, 0, L, 62, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("RELATÓRIO DE COMPRAS", M, 30);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`, M, 48);
    doc.text(`${linhas.length} produto(s)`, L - M, 30, { align: "right" });
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
    t("COR", cols.cor);
    t("QTD", cols.qtd, "right");
    return y + 20;
  };

  cabecalho();
  let y = cabecalhoTabela(84);
  let unidades = 0;

  linhas.forEach((l, i) => {
    const FOTO = 34;
    const foto = fotos[i];
    const larguraNome = cols.prod[1] - 8 - FOTO - 6;
    const nomeLinhas = doc.splitTextToSize(l.produto, larguraNome) as string[];
    const ref = [l.pedido ? `#${l.pedido}` : "", l.cliente ?? ""].filter(Boolean).join(" · ");
    const refLinhas = doc.splitTextToSize(ref, cols.ped[1] - 8) as string[];
    const corLinhas = doc.splitTextToSize(l.cor || "—", cols.cor[1] - 8) as string[];
    const nLinhas = Math.max(nomeLinhas.length, refLinhas.length, corLinhas.length, 1);
    const h = Math.max(FOTO + 10, nLinhas * 11 + 10);

    if (y + h > A - 50) {
      doc.addPage();
      cabecalho();
      y = cabecalhoTabela(84);
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

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...FRACO);
    doc.text(refLinhas, cols.ped[0] + 4, y + 16);
    doc.text(corLinhas, cols.cor[0] + 4, y + 16);

    doc.setTextColor(...TEXTO);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(num(l.quantidade), cols.qtd[0] + cols.qtd[1] - 4, y + 17, { align: "right" });
    unidades += l.quantidade;

    y += h;
  });

  if (y + 40 > A - 40) { doc.addPage(); cabecalho(); y = 84; }
  y += 20;
  doc.setDrawColor(...BORDA);
  doc.line(M, y, M + largura, y);
  y += 16;
  doc.setTextColor(...TEXTO);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Total de unidades: ${num(unidades)}`, M, y);

  doc.save(`relatorio-compras-${new Date().toISOString().slice(0, 10)}.pdf`);
}

const escHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function gerarRelatorioComprasHTML(linhas: LinhaRelatorioCompra[]) {
  const linhasHtml = linhas.map(l => `
    <tr>
      <td>${escHtml(l.pedido ?? "—")}</td>
      <td>${l.foto ? `<img src="${escHtml(l.foto)}" alt="" width="60" height="60" style="object-fit:cover;border-radius:6px" />` : ""}</td>
      <td>${escHtml(l.produto)}</td>
      <td>${escHtml(l.cor ?? "—")}</td>
      <td style="text-align:right">${l.quantidade}</td>
    </tr>`).join("");

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Relatório de compras</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;margin:24px;color:#17203a}
  h1{font-size:18px;margin:0 0 4px}
  p.meta{color:#6e7a8c;font-size:12px;margin:0 0 18px}
  table{border-collapse:collapse;width:100%}
  th,td{border:1px solid #d9e0e8;padding:6px 8px;font-size:13px;vertical-align:middle}
  th{background:#0a2a56;color:#fff;text-align:left;font-size:11px;text-transform:uppercase}
  tr:nth-child(even) td{background:#f5f7fa}
  td:last-child,th:last-child{text-align:right}
</style>
</head>
<body>
  <h1>Relatório de compras</h1>
  <p class="meta">Gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} — ${linhas.length} produto(s). Edite direto nesta tabela, ou selecione tudo (Ctrl+A) e cole no Excel/Google Sheets.</p>
  <table>
    <thead>
      <tr><th>Nº Pedido</th><th>Foto mockup</th><th>Descrição produto</th><th>Cor</th><th>Quantidade</th></tr>
    </thead>
    <tbody contenteditable="true">${linhasHtml}</tbody>
  </table>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `relatorio-compras-${new Date().toISOString().slice(0, 10)}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
