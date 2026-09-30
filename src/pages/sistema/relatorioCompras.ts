import { jsPDF } from "jspdf";

/* Solicitação de orçamento para o FORNECEDOR, a partir dos produtos
   SELECIONADOS na aba "Comprar" do sistema. Documento de marca -- logo da
   Gift Web, cabeçalho e cards elegantes -- pensado para ser enviado (PDF ou
   HTML) ou colado como texto puro no WhatsApp. Sem nome de cliente (não
   interessa ao fornecedor); o número do pedido aparece pequeno, só como
   referência interna. Três formatos, todos do mesmo botão:
   - PDF: para anexar.
   - HTML: baixa um .html pronto para abrir/enviar como documento (ex.: pelo
     próprio WhatsApp) -- não é uma planilha, é a cara do PDF em página web.
   - TXT: copia direto para a área de transferência, pronto para colar no
     WhatsApp como mensagem de texto. */

export interface LinhaRelatorioCompra {
  pedido: string | null;
  produto: string;
  cor: string | null;
  quantidade: number;
  foto: string | null;
}

const TITULO = "SOLICITAÇÃO DE ORÇAMENTO";
const LOGO_URL = "/logos/giftweb-logo.png";
const LOGO_URL_ABSOLUTA = "https://www.giftwebbrindes.com.br/logos/giftweb-logo.png";

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

const AZUL_ESCURO = [10, 42, 86] as const;
const VERDE = [21, 128, 61] as const;
const CINZA_CLARO = [247, 249, 252] as const;
const BRANCO = [255, 255, 255] as const;
const BORDA = [223, 229, 237] as const;
const TEXTO = [17, 32, 56] as const;
const FRACO = [116, 128, 145] as const;
const num = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

export async function gerarRelatorioComprasPDF(linhas: LinhaRelatorioCompra[]) {
  const [logo, ...fotos] = await Promise.all([
    carregarImagem(LOGO_URL),
    ...linhas.map(l => (l.foto ? carregarImagem(l.foto) : Promise.resolve(null))),
  ]);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const L = 595, A = 842, M = 36;
  const largura = L - M * 2;
  const FOTO = 100;
  const QTD_W = 92;

  const cabecalho = () => {
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, L, A, "F");
    if (logo) {
      try {
        const pr = doc.getImageProperties(logo);
        const alt = 48, larg = (pr.width / pr.height) * alt;
        doc.addImage(logo, M, 16, larg, alt, undefined, "FAST");
      } catch { /* segue sem logo */ }
    }
    doc.setTextColor(...AZUL_ESCURO);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(19);
    doc.text(TITULO, M + 58, 38);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...FRACO);
    doc.text("Gift Web Brindes · Brindes corporativos personalizados", M + 58, 53);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...TEXTO);
    doc.text(new Date().toLocaleDateString("pt-BR"), L - M, 30, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...FRACO);
    doc.text(`${linhas.length} produto(s)`, L - M, 44, { align: "right" });

    doc.setFillColor(...VERDE);
    doc.rect(0, 72, L, 3, "F");
  };

  cabecalho();
  let y = 96;

  linhas.forEach((l, i) => {
    const foto = fotos[i];
    const xTexto = M + 14 + FOTO + 18;
    const xQtd = M + largura - QTD_W - 10;
    const larguraTexto = xQtd - 10 - xTexto;
    const nomeLinhas = doc.splitTextToSize(l.produto, larguraTexto) as string[];
    const h = Math.max(FOTO + 28, nomeLinhas.length * 19 + 78);

    if (y + h > A - 30) {
      doc.addPage();
      cabecalho();
      y = 96;
    }

    const fundo: readonly [number, number, number] = i % 2 === 0 ? CINZA_CLARO : BRANCO;
    doc.setFillColor(...fundo);
    doc.roundedRect(M, y, largura, h, 8, 8, "F");
    doc.setDrawColor(...BORDA);
    doc.roundedRect(M, y, largura, h, 8, 8, "S");

    const cy = y + h / 2;
    // foto: sempre inteira (nunca recortada), centralizada num quadrado.
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(M + 14, cy - FOTO / 2, FOTO, FOTO, 6, 6, "F");
    doc.setDrawColor(...BORDA);
    doc.roundedRect(M + 14, cy - FOTO / 2, FOTO, FOTO, 6, 6, "S");
    if (foto) {
      try {
        const pr = doc.getImageProperties(foto);
        const esc = Math.min((FOTO - 8) / pr.width, (FOTO - 8) / pr.height);
        const w = pr.width * esc, hh = pr.height * esc;
        doc.addImage(foto, M + 14 + (FOTO - w) / 2, cy - hh / 2, w, hh, undefined, "FAST");
      } catch { /* imagem inválida: segue sem foto */ }
    }

    const yBloco = cy - (nomeLinhas.length * 19) / 2 - 14;
    doc.setTextColor(...TEXTO);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.text(nomeLinhas, xTexto, yBloco + 15);

    let yInfo = yBloco + 15 + nomeLinhas.length * 19 + 3;
    if (l.pedido) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...FRACO);
      doc.text(`Pedido #${l.pedido}`, xTexto, yInfo);
      yInfo += 15;
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11.5);
    doc.setTextColor(...FRACO);
    doc.text(`Cor: ${l.cor || "—"}`, xTexto, yInfo);

    doc.setFillColor(...VERDE);
    doc.roundedRect(xQtd, cy - FOTO / 2, QTD_W, FOTO, 8, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.text(num(l.quantidade), xQtd + QTD_W / 2, cy - 2, { align: "center" });
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "normal");
    doc.text("unidades", xQtd + QTD_W / 2, cy + 16, { align: "center" });

    y += h + 10;
  });

  doc.save(`solicitacao-de-orcamento-${new Date().toISOString().slice(0, 10)}.pdf`);
}

const escHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function gerarRelatorioComprasHTML(linhas: LinhaRelatorioCompra[]) {
  const linhasHtml = linhas.map(l => `
    <div class="card">
      <div class="foto">${l.foto ? `<img src="${escHtml(l.foto)}" alt="" />` : ""}</div>
      <div class="info">
        <h3>${escHtml(l.produto)}</h3>
        ${l.pedido ? `<p class="pedido">Pedido #${escHtml(l.pedido)}</p>` : ""}
        <p class="cor">Cor: ${escHtml(l.cor ?? "—")}</p>
      </div>
      <div class="qtd">
        <b>${l.quantidade}</b>
        <span>unidades</span>
      </div>
    </div>`).join("");

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${TITULO}</title>
<style>
  *{box-sizing:border-box}
  body{font-family:Arial,Helvetica,sans-serif;margin:0;background:#eef2f7;color:#111838;
    padding:28px 16px}
  .folha{max-width:720px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;
    box-shadow:0 10px 30px rgba(10,42,86,.12)}
  .cab{display:flex;align-items:center;gap:16px;padding:26px 28px 20px}
  .cab img{width:52px;height:52px;flex:none}
  .cab h1{font-size:20px;margin:0;color:#0a2a56;letter-spacing:.01em}
  .cab p{margin:3px 0 0;font-size:12px;color:#748094}
  .cab .meta{margin-left:auto;text-align:right;font-size:12px;color:#748094}
  .cab .meta b{display:block;font-size:13px;color:#111838}
  .faixa{height:4px;background:#15803d}
  .lista{padding:18px 20px 26px;display:flex;flex-direction:column;gap:10px}
  .card{display:flex;align-items:center;gap:16px;background:#f7f9fc;border:1px solid #dfe5ed;
    border-radius:10px;padding:12px}
  .foto{width:92px;height:92px;flex:none;background:#fff;border:1px solid #dfe5ed;border-radius:8px;
    display:flex;align-items:center;justify-content:center;overflow:hidden}
  .foto img{width:100%;height:100%;object-fit:contain}
  .info{flex:1;min-width:0}
  .info h3{margin:0 0 3px;font-size:16px;color:#111838;font-weight:700}
  .info .pedido{margin:0 0 2px;font-size:11px;color:#9aa4b4}
  .info .cor{margin:0;font-size:13px;color:#5b6779}
  .qtd{flex:none;width:78px;background:#15803d;border-radius:8px;padding:12px 6px;text-align:center;color:#fff}
  .qtd b{display:block;font-size:22px;line-height:1}
  .qtd span{display:block;font-size:10px;margin-top:2px;opacity:.9}
  .rod{padding:16px 28px 24px;text-align:center;font-size:11px;color:#9aa4b4}
</style>
</head>
<body>
  <div class="folha">
    <div class="cab">
      <img src="${LOGO_URL_ABSOLUTA}" alt="Gift Web Brindes" />
      <div>
        <h1>${TITULO}</h1>
        <p>Gift Web Brindes · Brindes corporativos personalizados</p>
      </div>
      <div class="meta"><b>${new Date().toLocaleDateString("pt-BR")}</b>${linhas.length} produto(s)</div>
    </div>
    <div class="faixa"></div>
    <div class="lista">${linhasHtml}</div>
    <div class="rod">Gift Web Brindes · giftwebbrindes.com.br</div>
  </div>
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
    .map((l, i) => `${i + 1}. ${l.produto}${l.pedido ? ` (pedido #${l.pedido})` : ""}\n   Cor: ${l.cor || "—"}\n   Quantidade: ${num(l.quantidade)} un.`)
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
