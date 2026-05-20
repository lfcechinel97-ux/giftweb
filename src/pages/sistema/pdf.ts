import { jsPDF } from "jspdf";
import type { Orcamento, Cliente, LookupItem } from "@/contexts/SistemaContext";

interface Sis {
  clientes: Cliente[];
  vendedores: LookupItem[];
  meiosPagamento: LookupItem[];
  transportadoras: LookupItem[];
  origens: LookupItem[];
}

// ─── Paleta premium (azul marinho + verde) ─────────────────────────────────
const C = {
  ink: [7, 20, 38] as [number, number, number],         // #071426 navy
  navy: [11, 31, 56] as [number, number, number],       // #0B1F38 navy alt
  body: [37, 47, 64] as [number, number, number],
  muted: [107, 114, 128] as [number, number, number],
  subtle: [148, 163, 184] as [number, number, number],
  line: [226, 232, 240] as [number, number, number],
  surface: [245, 247, 250] as [number, number, number], // #F5F7FA
  accent: [22, 196, 127] as [number, number, number],   // #16C47F verde
  accentDark: [15, 169, 104] as [number, number, number], // #0FA968
  accentSoft: [230, 252, 242] as [number, number, number],
  gold: [202, 138, 4] as [number, number, number],
  goldSoft: [254, 249, 195] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

const setFill = (doc: jsPDF, c: [number, number, number]) => doc.setFillColor(c[0], c[1], c[2]);
const setText = (doc: jsPDF, c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);
const setDraw = (doc: jsPDF, c: [number, number, number]) => doc.setDrawColor(c[0], c[1], c[2]);

async function loadImageAsDataURL(src: string): Promise<string | null> {
  if (!src) return null;
  if (src.startsWith("data:")) return src;
  try {
    const res = await fetch(src, { mode: "cors" });
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  } catch { return null; }
}

const lookupName = (list: LookupItem[], id: string | undefined) =>
  list.find(x => x.id === id)?.nome || "—";

function formatDate(iso: string | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function fmtBRL(valor: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor);
}

function formatDocumento(doc: string, tipo: "PF" | "PJ"): string {
  const digits = doc.replace(/\D/g, "");
  if (!digits) return "—";
  if (tipo === "PJ" && digits.length === 14)
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (tipo === "PF" && digits.length === 11)
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return digits;
}

// ─── Helpers de desenho ────────────────────────────────────────────────────
function pill(doc: jsPDF, x: number, y: number, label: string, opts: {
  bg: [number, number, number]; fg: [number, number, number]; padX?: number; fontSize?: number;
}): number {
  const padX = opts.padX ?? 8;
  const fs = opts.fontSize ?? 7.5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(fs);
  const w = doc.getTextWidth(label) + padX * 2;
  const h = fs + 7;
  setFill(doc, opts.bg);
  doc.roundedRect(x, y, w, h, h / 2, h / 2, "F");
  setText(doc, opts.fg);
  doc.text(label, x + padX, y + h - 5);
  return w;
}

function ensureSpace(doc: jsPDF, y: number, need: number, topMargin = 50): number {
  const ph = doc.internal.pageSize.getHeight();
  if (y + need > ph - 60) {
    doc.addPage();
    return topMargin;
  }
  return y;
}

function drawFooterPagina(doc: jsPDF) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    setDraw(doc, C.line); doc.setLineWidth(0.5);
    doc.line(40, H - 32, W - 40, H - 32);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); setText(doc, C.muted);
    doc.text("Gift Web Brindes Personalizados  ·  contato@giftwebbrindes.com.br  ·  giftwebbrindes.com.br", 40, H - 20);
    doc.text(`${i} / ${total}`, W - 40, H - 20, { align: "right" });
  }
}

// ─── PDF principal ─────────────────────────────────────────────────────────
export async function gerarPDFOrcamento(orc: Orcamento, sis?: Sis, clienteNome?: string): Promise<void> {
  const sistema = sis || { clientes: [], vendedores: [], meiosPagamento: [], transportadoras: [], origens: [] };
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 40; // margem lateral

  // Fundo branco geral
  setFill(doc, C.white);
  doc.rect(0, 0, W, doc.internal.pageSize.getHeight(), "F");

  // ── CABEÇALHO ────────────────────────────────────────────────────────────
  // Selo PROPOSTA COMERCIAL
  pill(doc, M, 48, "PROPOSTA COMERCIAL", { bg: C.accentSoft, fg: C.accent, padX: 10, fontSize: 7.5 });

  // Logotipo textual moderno
  doc.setFont("helvetica", "bold"); doc.setFontSize(22); setText(doc, C.ink);
  doc.text("Gift Web", M, 92);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); setText(doc, C.muted);
  doc.text("Brindes corporativos personalizados", M, 106);

  // Lado direito: Nº + data
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); setText(doc, C.subtle);
  doc.text(`ORÇAMENTO Nº`, W - M, 52, { align: "right" });
  doc.setFont("helvetica", "bold"); doc.setFontSize(26); setText(doc, C.ink);
  doc.text(orc.numero, W - M, 80, { align: "right" });

  // Data com destaque
  const dataEmissao = formatDate(orc.createdAt);
  const dataValidade = new Date(orc.createdAt);
  dataValidade.setDate(dataValidade.getDate() + 15);

  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); setText(doc, C.subtle);
  doc.text("EMISSÃO", W - M, 96, { align: "right" });
  doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); setText(doc, C.body);
  doc.text(dataEmissao, W - M, 108, { align: "right" });

  // Separador fino
  setDraw(doc, C.line); doc.setLineWidth(0.6);
  doc.line(M, 132, W - M, 132);

  let y = 156;

  // ── CARD DO CLIENTE ──────────────────────────────────────────────────────
  const cliente = sistema.clientes.find(c => c.id === orc.clienteId);
  const isPJ = cliente?.tipo === "PJ";
  const endereco = cliente?.enderecos?.[0];
  const enderecoLinha1 = endereco
    ? [endereco.logradouro, endereco.numero].filter(Boolean).join(", ") +
      (endereco.complemento ? ` — ${endereco.complemento}` : "")
    : "";
  const enderecoLinha2 = endereco
    ? [endereco.bairro, [endereco.cidade, endereco.uf].filter(Boolean).join("/")].filter(Boolean).join(" · ")
    : "";

  const contatoNome = orc.contatoNome || cliente?.contatos?.[0]?.nome || "";
  const contatoTel = orc.contatoTelefone || cliente?.contatos?.[0]?.telefone || "";
  const contatoEmail = orc.contatoEmail || cliente?.contatos?.[0]?.email || "";
  const linhaContato = [contatoNome, contatoTel, contatoEmail].filter(Boolean).join("  ·  ");

  const vendedorNome = lookupName(sistema.vendedores, orc.vendedorId);

  // Altura dinâmica do card
  const linhasEnd = endereco ? 2 : 0;
  const linhasContato = linhaContato ? 1 : 0;
  const cardClienteH = 90 + linhasEnd * 14 + linhasContato * 14;

  // Card outline (sem fundo, estilo Apple/Stripe)
  setDraw(doc, C.line); doc.setLineWidth(0.8);
  doc.roundedRect(M, y, W - M * 2, cardClienteH, 8, 8, "S");

  // Coluna esquerda — Cliente
  const colW = (W - M * 2) / 2;
  const padX = 20;
  let cy = y + 22;

  doc.setFont("helvetica", "normal"); doc.setFontSize(7); setText(doc, C.subtle);
  doc.text("CLIENTE", M + padX, cy);
  cy += 16;

  doc.setFont("helvetica", "bold"); doc.setFontSize(13); setText(doc, C.ink);
  const nomeCliente = cliente?.nome || orc.contatoNome || clienteNome || "—";
  const nomeLines = doc.splitTextToSize(nomeCliente, colW - padX * 2);
  doc.text(nomeLines.slice(0, 2), M + padX, cy);
  cy += nomeLines.length > 1 ? 28 : 16;

  const docLabel = isPJ ? "CNPJ" : "CPF";
  const docValue = cliente?.documento ? formatDocumento(cliente.documento, cliente.tipo) : "—";
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); setText(doc, C.body);
  doc.text(`${docLabel}: ${docValue}`, M + padX, cy);
  cy += 14;

  if (enderecoLinha1) {
    doc.setFontSize(8); setText(doc, C.muted);
    doc.text(doc.splitTextToSize(enderecoLinha1, colW - padX * 2).slice(0, 1), M + padX, cy);
    cy += 12;
  }
  if (enderecoLinha2) {
    doc.setFontSize(8); setText(doc, C.muted);
    doc.text(enderecoLinha2, M + padX, cy);
    cy += 12;
  }
  if (linhaContato) {
    doc.setFontSize(8); setText(doc, C.muted);
    doc.text(doc.splitTextToSize(linhaContato, colW - padX * 2).slice(0, 1), M + padX, cy);
  }

  // Divisor vertical interno
  setDraw(doc, C.line); doc.setLineWidth(0.5);
  doc.line(M + colW, y + 14, M + colW, y + cardClienteH - 14);

  // Coluna direita — Vendedor + selo
  const rx = M + colW + padX;
  let ry = y + 22;
  doc.setFont("helvetica", "normal"); doc.setFontSize(7); setText(doc, C.subtle);
  doc.text("SEU CONSULTOR", rx, ry);
  ry += 16;

  doc.setFont("helvetica", "bold"); doc.setFontSize(12); setText(doc, C.ink);
  doc.text(vendedorNome, rx, ry);
  ry += 18;

  // Selo TOP 1
  pill(doc, rx, ry - 2, "TOP 1 VENDEDOR GIFT WEB", {
    bg: C.goldSoft, fg: C.gold, padX: 9, fontSize: 7,
  });

  y += cardClienteH + 18;

  // ── BARRA DE DIFERENCIAIS ────────────────────────────────────────────────
  const benefits = [
    "Produção em até 48h",
    "Nota Fiscal e Garantia",
    "Entrega para todo Brasil",
    "Atendimento Especializado",
    "Qualidade Premium",
  ];
  const barH = 38;
  setFill(doc, C.surface);
  doc.roundedRect(M, y, W - M * 2, barH, 8, 8, "F");

  const segW = (W - M * 2) / benefits.length;
  benefits.forEach((b, i) => {
    const cx = M + segW * i + segW / 2;
    // Check mark verde
    setDraw(doc, C.accent); doc.setLineWidth(1.4);
    const cmX = cx - doc.getTextWidth(b) / 2 - 12;
    doc.line(cmX, y + barH / 2, cmX + 3, y + barH / 2 + 3);
    doc.line(cmX + 3, y + barH / 2 + 3, cmX + 8, y + barH / 2 - 3);
    // Texto
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); setText(doc, C.body);
    doc.text(b, cx + 4, y + barH / 2 + 3, { align: "center" });
    // Divisor entre itens
    if (i < benefits.length - 1) {
      setDraw(doc, C.line); doc.setLineWidth(0.4);
      doc.line(M + segW * (i + 1), y + 10, M + segW * (i + 1), y + barH - 10);
    }
  });

  y += barH + 24;

  // ── PRODUTOS ─────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold"); doc.setFontSize(10); setText(doc, C.ink);
  doc.text("ITENS DA PROPOSTA", M, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); setText(doc, C.muted);
  doc.text(`${orc.itens.length} ${orc.itens.length === 1 ? "item" : "itens"}`, W - M, y, { align: "right" });
  y += 14;

  const cardH = 124;
  const imgSize = 100;
  const imgX = M + 14;

  for (const item of orc.itens) {
    y = ensureSpace(doc, y, cardH + 10);

    // Card branco com borda fina + sombra simulada
    setFill(doc, [243, 244, 246]);
    doc.roundedRect(M + 1, y + 2, W - M * 2, cardH, 10, 10, "F"); // sombra
    setFill(doc, C.white);
    setDraw(doc, C.line); doc.setLineWidth(0.8);
    doc.roundedRect(M, y, W - M * 2, cardH, 10, 10, "FD");

    // Imagem com placeholder
    const imgSrc = item.mockupImagem || item.imagem;
    let hasImg = false;
    if (imgSrc) {
      const img = await loadImageAsDataURL(imgSrc);
      if (img) {
        try {
          // Moldura
          setFill(doc, C.surface);
          doc.roundedRect(imgX, y + 12, imgSize, imgSize, 6, 6, "F");
          doc.addImage(img, "JPEG", imgX + 2, y + 14, imgSize - 4, imgSize - 4, undefined, "FAST");
          hasImg = true;
        } catch { /* ignore */ }
      }
    }
    if (!hasImg) {
      setFill(doc, C.surface);
      doc.roundedRect(imgX, y + 12, imgSize, imgSize, 6, 6, "F");
      doc.setFont("helvetica", "normal"); doc.setFontSize(7); setText(doc, C.subtle);
      doc.text("Sem imagem", imgX + imgSize / 2, y + 12 + imgSize / 2 + 2, { align: "center" });
    }

    const tx = imgX + imgSize + 18;
    const txW = W - M - tx - 14;

    // Nome
    doc.setFont("helvetica", "bold"); doc.setFontSize(11.5); setText(doc, C.ink);
    const nameLines = doc.splitTextToSize(item.nome, txW);
    doc.text(nameLines.slice(0, 2), tx, y + 28);
    const afterName = y + 28 + (nameLines.length > 1 ? 28 : 14);

    // Código (chip discreto)
    if (item.codigoComposto) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
      const codeW = doc.getTextWidth(item.codigoComposto) + 12;
      setFill(doc, C.surface);
      doc.roundedRect(tx, afterName - 9, codeW, 14, 7, 7, "F");
      setText(doc, C.muted);
      doc.text(item.codigoComposto, tx + 6, afterName);
    }

    // Quantidade
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); setText(doc, C.muted);
    doc.text(`Quantidade: `, tx, afterName + 18);
    doc.setFont("helvetica", "bold"); setText(doc, C.body);
    const qLabel = `Quantidade: `;
    doc.text(`${item.quantidade} un.`, tx + doc.getTextWidth(qLabel), afterName + 18);

    // Unitário
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); setText(doc, C.muted);
    doc.text("Valor unitário", tx, y + cardH - 18);
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); setText(doc, C.body);
    doc.text(fmtBRL(item.precoUnitario), tx, y + cardH - 6);

    // Total à direita
    const totalItem = item.precoUnitario * item.quantidade;
    const originalItem = (item.precoOriginal ?? item.precoUnitario) * item.quantidade;
    const temDesconto = originalItem > totalItem + 0.01;

    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); setText(doc, C.subtle);
    doc.text("TOTAL DO ITEM", W - M - 14, y + 28, { align: "right" });

    if (temDesconto) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); setText(doc, C.subtle);
      const origStr = fmtBRL(originalItem);
      doc.text(origStr, W - M - 14, y + 44, { align: "right" });
      // Linha riscada
      const origW = doc.getTextWidth(origStr);
      setDraw(doc, C.subtle); doc.setLineWidth(0.6);
      doc.line(W - M - 14 - origW, y + 41, W - M - 14, y + 41);
    }

    doc.setFont("helvetica", "bold"); doc.setFontSize(16); setText(doc, C.ink);
    doc.text(fmtBRL(totalItem), W - M - 14, temDesconto ? y + 70 : y + 56, { align: "right" });

    y += cardH + 10;
  }

  // ── TOTAIS ───────────────────────────────────────────────────────────────
  const subtotal = orc.subtotal ?? orc.itens.reduce((s, i) => s + i.precoUnitario * i.quantidade, 0);
  const subtotalOriginal = orc.itens.reduce(
    (s, i) => s + (i.precoOriginal ?? i.precoUnitario) * i.quantidade, 0
  );
  const economia = Math.max(0, subtotalOriginal - subtotal);
  const total = subtotal + (orc.freteValor || 0);
  const totalOriginal = subtotalOriginal + (orc.freteValor || 0);

  const totalBoxH = economia > 0 ? 130 : 96;
  y = ensureSpace(doc, y + 6, totalBoxH + 20);

  // Frete (linha discreta acima do total)
  if (orc.freteValor && orc.freteValor > 0) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); setText(doc, C.muted);
    doc.text(`Frete (${orc.freteTipo || "—"})`, W - M - 200, y);
    doc.text(fmtBRL(orc.freteValor), W - M, y, { align: "right" });
    y += 14;
  }
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); setText(doc, C.muted);
  doc.text("Subtotal dos itens", W - M - 200, y);
  doc.text(fmtBRL(subtotal), W - M, y, { align: "right" });
  y += 16;

  // Box do total
  setFill(doc, C.ink);
  doc.roundedRect(M, y, W - M * 2, totalBoxH, 10, 10, "F");

  doc.setFont("helvetica", "normal"); doc.setFontSize(8); setText(doc, [180, 188, 200]);
  doc.text("VALOR TOTAL DA PROPOSTA", M + 24, y + 26);

  if (economia > 0) {
    // DE
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); setText(doc, [156, 163, 175]);
    const deStr = `de ${fmtBRL(totalOriginal)}`;
    doc.text(deStr, M + 24, y + 44);
    const deW = doc.getTextWidth(deStr);
    setDraw(doc, [156, 163, 175]); doc.setLineWidth(0.6);
    doc.line(M + 24, y + 41.5, M + 24 + deW, y + 41.5);

    // POR
    doc.setFont("helvetica", "bold"); doc.setFontSize(30); setText(doc, C.white);
    doc.text(fmtBRL(total), M + 24, y + 78);

    // Selo de economia
    const ecoLabel = `Você economiza ${fmtBRL(economia)}`;
    doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    const ecoW = doc.getTextWidth(ecoLabel) + 20;
    setFill(doc, C.accent);
    doc.roundedRect(M + 24, y + 92, ecoW, 22, 11, 11, "F");
    setText(doc, C.white);
    doc.text(ecoLabel, M + 24 + 10, y + 107);
  } else {
    doc.setFont("helvetica", "bold"); doc.setFontSize(32); setText(doc, C.white);
    doc.text(fmtBRL(total), M + 24, y + 70);
  }

  // Lado direito: forma resumida
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); setText(doc, [156, 163, 175]);
  doc.text("PAGAMENTO", W - M - 24, y + 26, { align: "right" });
  doc.setFont("helvetica", "bold"); doc.setFontSize(10); setText(doc, C.white);
  doc.text(lookupName(sistema.meiosPagamento, orc.pagamentoId), W - M - 24, y + 42, { align: "right" });

  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); setText(doc, [156, 163, 175]);
  doc.text("VALIDADE DA PROPOSTA", W - M - 24, y + 64, { align: "right" });
  doc.setFont("helvetica", "bold"); doc.setFontSize(10); setText(doc, C.white);
  doc.text(formatDate(dataValidade.toISOString()), W - M - 24, y + 80, { align: "right" });

  y += totalBoxH + 24;

  // ── CONDIÇÕES (cards) ────────────────────────────────────────────────────
  y = ensureSpace(doc, y, 90);

  const cards = [
    { label: "PRAZO DE ENTREGA", value: orc.prazoEntrega ? `${orc.prazoEntrega} dias úteis` : "À combinar" },
    { label: "FORMA DE PAGAMENTO", value: lookupName(sistema.meiosPagamento, orc.pagamentoId) },
    { label: "TRANSPORTE", value: orc.freteTipo === "FOB" ? "FOB · Cliente retira" : lookupName(sistema.transportadoras, orc.transportadoraId) },
    { label: "VALIDADE", value: formatDate(dataValidade.toISOString()) },
  ];

  const gap = 10;
  const cw = (W - M * 2 - gap * 3) / 4;
  const ch = 60;
  cards.forEach((c, i) => {
    const cx = M + (cw + gap) * i;
    setDraw(doc, C.line); doc.setLineWidth(0.8);
    doc.roundedRect(cx, y, cw, ch, 8, 8, "S");
    doc.setFont("helvetica", "normal"); doc.setFontSize(6.5); setText(doc, C.subtle);
    doc.text(c.label, cx + 12, y + 18);
    doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); setText(doc, C.ink);
    const lines = doc.splitTextToSize(c.value, cw - 24);
    doc.text(lines.slice(0, 2), cx + 12, y + 34);
  });
  y += ch + 22;

  // ── OBSERVAÇÕES ──────────────────────────────────────────────────────────
  if (orc.observacoes) {
    y = ensureSpace(doc, y, 60);
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); setText(doc, C.subtle);
    doc.text("OBSERVAÇÕES", M, y);
    y += 12;
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); setText(doc, C.body);
    const lines = doc.splitTextToSize(orc.observacoes, W - M * 2);
    doc.text(lines, M, y);
    y += lines.length * 12 + 8;
  }

  // ── FRASE FINAL ──────────────────────────────────────────────────────────
  y = ensureSpace(doc, y, 50);
  setDraw(doc, C.line); doc.setLineWidth(0.6);
  doc.line(M, y, W - M, y);
  y += 22;
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); setText(doc, C.ink);
  doc.text("Estamos à disposição para tornar seu projeto ainda mais especial.", W / 2, y, { align: "center" });
  y += 14;
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); setText(doc, C.muted);
  doc.text("Equipe Gift Web Brindes", W / 2, y, { align: "center" });

  // ── RODAPÉ DE TODAS AS PÁGINAS ───────────────────────────────────────────
  drawFooterPagina(doc);

  const nomeClienteLimpo = (clienteNome || cliente?.nome || "Cliente")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, " ");
  doc.save(`Proposta GiftWeb x ${nomeClienteLimpo} - ${orc.numero}.pdf`);
}

// ─── Pedido (mantém formato simples) ──────────────────────────────────────
export async function gerarPDFPedido(pedido: any, _sis?: Sis): Promise<void> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();

  pill(doc, 40, 48, "PEDIDO DE PRODUÇÃO", { bg: C.accentSoft, fg: C.accent, padX: 10, fontSize: 7.5 });
  doc.setFont("helvetica", "bold"); doc.setFontSize(22); setText(doc, C.ink);
  doc.text("Gift Web", 40, 92);

  doc.setFont("helvetica", "normal"); doc.setFontSize(8); setText(doc, C.subtle);
  doc.text("PEDIDO Nº", W - 40, 52, { align: "right" });
  doc.setFont("helvetica", "bold"); doc.setFontSize(26); setText(doc, C.ink);
  doc.text(String(pedido.numero), W - 40, 80, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); setText(doc, C.muted);
  doc.text(formatDate(pedido.createdAt), W - 40, 96, { align: "right" });

  doc.save(`pedido-${pedido.numero}.pdf`);
}
