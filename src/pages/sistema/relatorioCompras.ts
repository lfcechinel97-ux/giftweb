import { jsPDF } from "jspdf";

/* Solicitação de orçamento para o FORNECEDOR, a partir dos produtos
   SELECIONADOS na aba "Comprar" do sistema. É um documento externo: sem
   número de pedido nem nome de cliente, só o que o fornecedor precisa para
   cotar -- foto grande, nome do produto, cor e quantidade. Três formatos,
   todos disparados do mesmo botão:
   - PDF: para anexar.
   - HTML: baixa um arquivo .html com uma <table> de verdade -- colado no
     Excel/Sheets vira células normais, então funciona como "editável" sem
     precisar gerar um .xlsx de fato.
   - TXT: copia direto para a área de transferência, pronto para colar no
     WhatsApp como mensagem de texto. */

export interface LinhaRelatorioCompra {
  produto: string;
  cor: string | null;
  quantidade: number;
  foto: string | null;
}

const TITULO = "SOLICITAÇÃO DE ORÇAMENTO";

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
  const FOTO = 78;

  const cabecalho = () => {
    doc.setFillColor(...AZUL);
    doc.rect(0, 0, L, 60, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    doc.text(TITULO, M, 32);
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "normal");
    doc.text(`${new Date().toLocaleDateString("pt-BR")} — ${linhas.length} produto(s)`, M, 47);
  };

  cabecalho();
  let y = 84;

  linhas.forEach((l, i) => {
    const foto = fotos[i];
    const xTexto = M + 12 + FOTO + 16;
    const larguraTexto = largura - 12 - FOTO - 16 - 12;
    const nomeLinhas = doc.splitTextToSize(l.produto, larguraTexto) as string[];
    const h = Math.max(FOTO + 24, nomeLinhas.length * 20 + 56);

    if (y + h > A - 30) {
      doc.addPage();
      cabecalho();
      y = 84;
    }

    if (i % 2 === 0) { doc.setFillColor(...CINZA); doc.rect(M, y, largura, h, "F"); }
    doc.setDrawColor(...BORDA);
    doc.rect(M, y, largura, h);

    const cy = y + h / 2;
    if (foto) {
      try {
        const pr = doc.getImageProperties(foto);
        const esc = Math.min(FOTO / pr.width, FOTO / pr.height);
        const w = pr.width * esc, hh = pr.height * esc;
        doc.setFillColor(255, 255, 255);
        doc.rect(M + 12, cy - FOTO / 2, FOTO, FOTO, "F");
        doc.addImage(foto, M + 12 + (FOTO - w) / 2, cy - hh / 2, w, hh, undefined, "FAST");
      } catch { /* imagem inválida: segue sem foto */ }
    } else {
      doc.setDrawColor(...BORDA);
      doc.rect(M + 12, cy - FOTO / 2, FOTO, FOTO);
    }

    doc.setTextColor(...TEXTO);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(nomeLinhas, xTexto, cy - (nomeLinhas.length - 1) * 10 - 8);

    const yInfo = cy - (nomeLinhas.length - 1) * 10 - 8 + nomeLinhas.length * 17 + 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11.5);
    doc.setTextColor(...FRACO);
    doc.text(`Cor: ${l.cor || "—"}`, xTexto, yInfo);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...AZUL);
    doc.text(`Quantidade: ${num(l.quantidade)} un.`, xTexto, yInfo + 20);

    y += h;
  });

  doc.save(`solicitacao-de-orcamento-${new Date().toISOString().slice(0, 10)}.pdf`);
}

const escHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function gerarRelatorioComprasHTML(linhas: LinhaRelatorioCompra[]) {
  const linhasHtml = linhas.map(l => `
    <tr>
      <td>${l.foto ? `<img src="${escHtml(l.foto)}" alt="" width="110" height="110" style="object-fit:cover;border-radius:8px" />` : ""}</td>
      <td><b>${escHtml(l.produto)}</b></td>
      <td>${escHtml(l.cor ?? "—")}</td>
      <td style="text-align:right"><b>${l.quantidade} un.</b></td>
    </tr>`).join("");

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>${TITULO}</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;margin:24px;color:#17203a}
  h1{font-size:20px;margin:0 0 4px;letter-spacing:.02em}
  p.meta{color:#6e7a8c;font-size:12px;margin:0 0 18px}
  table{border-collapse:collapse;width:100%}
  th,td{border:1px solid #d9e0e8;padding:10px 12px;font-size:15px;vertical-align:middle}
  th{background:#0a2a56;color:#fff;text-align:left;font-size:11px;text-transform:uppercase}
  tr:nth-child(even) td{background:#f5f7fa}
  td:last-child,th:last-child{text-align:right}
</style>
</head>
<body>
  <h1>${TITULO}</h1>
  <p class="meta">${new Date().toLocaleDateString("pt-BR")} — ${linhas.length} produto(s). Edite direto nesta tabela, ou selecione tudo (Ctrl+A) e cole no Excel/Google Sheets.</p>
  <table>
    <thead>
      <tr><th>Foto</th><th>Produto</th><th>Cor</th><th>Quantidade</th></tr>
    </thead>
    <tbody contenteditable="true">${linhasHtml}</tbody>
  </table>
</body>
</html>`;

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `solicitacao-de-orcamento-${new Date().toISOString().slice(0, 10)}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Texto pronto pra colar no WhatsApp: uma linha por produto, bem espaçado. */
export function textoRelatorioCompras(linhas: LinhaRelatorioCompra[]): string {
  const cab = `*${TITULO}*\n${new Date().toLocaleDateString("pt-BR")}\n`;
  const corpo = linhas
    .map((l, i) => `${i + 1}. ${l.produto}\n   Cor: ${l.cor || "—"}\n   Quantidade: ${num(l.quantidade)} un.`)
    .join("\n\n");
  return `${cab}\n${corpo}`;
}

/** Copia o texto para a área de transferência; devolve se conseguiu. */
export async function copiarRelatorioComprasTXT(linhas: LinhaRelatorioCompra[]): Promise<boolean> {
  const texto = textoRelatorioCompras(linhas);
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    return false;
  }
}
