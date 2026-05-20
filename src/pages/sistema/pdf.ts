import { jsPDF } from "jspdf";
import type { Orcamento, Cliente, LookupItem } from "@/contexts/SistemaContext";
import { getNormalizedPriceRows } from "@/utils/price";

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

  // Fundo cinza claro geral (impacto visual)
  setFill(doc, C.surface);
  doc.rect(0, 0, W, doc.internal.pageSize.getHeight(), "F");

  // ── HERO MINIMALISTA — apenas marca + nº/emissão ─────────────────────────
  const heroH = 96;
  setFill(doc, C.ink);
  doc.rect(0, 0, W, heroH, "F");
  setFill(doc, C.accent);
  doc.rect(0, 0, W, 3, "F");

  // Lado esquerdo: marca elegante
  doc.setFont("helvetica", "bold"); doc.setFontSize(26); setText(doc, C.white);
  doc.text("Gift Web", M, 50);
  setFill(doc, C.accent);
  doc.rect(M, 58, 28, 2.5, "F");
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); setText(doc, [180, 200, 220]);
  doc.setCharSpace(1.5);
  doc.text("BRINDES CORPORATIVOS", M, 74);
  doc.setCharSpace(0);

  // Lado direito: Nº + emissão
  const dataEmissao = formatDate(orc.createdAt);
  const dataValidade = new Date(orc.createdAt);
  dataValidade.setDate(dataValidade.getDate() + 7);

  doc.setFont("helvetica", "normal"); doc.setFontSize(7); setText(doc, [170, 188, 210]);
  doc.setCharSpace(1.2);
  doc.text("ORÇAMENTO Nº", W - M, 32, { align: "right" });
  doc.setCharSpace(0);
  doc.setFont("helvetica", "bold"); doc.setFontSize(24); setText(doc, C.white);
  doc.text(orc.numero, W - M, 58, { align: "right" });
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); setText(doc, [180, 200, 220]);
  doc.text(`Emissão  ${dataEmissao}`, W - M, 74, { align: "right" });

  let y = heroH + 18;

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

  // Card cliente — altura compactada
  const cardClienteH = 118;

  setFill(doc, C.white);
  setDraw(doc, C.line); doc.setLineWidth(0.8);
  doc.roundedRect(M, y, W - M * 2, cardClienteH, 10, 10, "FD");
  setFill(doc, C.accent);
  doc.rect(M, y, 4, cardClienteH, "F");

  // Coluna esquerda — Cliente
  const colW = (W - M * 2) / 2;
  const padX = 20;
  let cy = y + 18;

  doc.setFont("helvetica", "bold"); doc.setFontSize(7); setText(doc, C.accentDark);
  doc.text("CLIENTE", M + padX, cy);
  cy += 13;

  doc.setFont("helvetica", "bold"); doc.setFontSize(12); setText(doc, C.ink);
  const nomeCliente = cliente?.nome || orc.contatoNome || clienteNome || "—";
  const nomeLines = doc.splitTextToSize(nomeCliente, colW - padX * 2);
  doc.text(nomeLines.slice(0, 2), M + padX, cy);
  cy += nomeLines.length > 1 ? 22 : 13;

  const docLabel = isPJ ? "CNPJ" : "CPF";
  const docValue = cliente?.documento ? formatDocumento(cliente.documento, cliente.tipo) : "—";
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); setText(doc, C.body);
  doc.text(`${docLabel}: ${docValue}`, M + padX, cy);
  cy += 11;

  if (enderecoLinha1) {
    doc.setFontSize(7.5); setText(doc, C.muted);
    doc.text(doc.splitTextToSize(enderecoLinha1, colW - padX * 2).slice(0, 1), M + padX, cy);
    cy += 10;
  }
  if (enderecoLinha2) {
    doc.setFontSize(7.5); setText(doc, C.muted);
    doc.text(enderecoLinha2, M + padX, cy);
    cy += 10;
  }
  if (linhaContato) {
    doc.setFontSize(7.5); setText(doc, C.muted);
    doc.text(doc.splitTextToSize(linhaContato, colW - padX * 2).slice(0, 1), M + padX, cy);
  }

  // Divisor vertical interno
  setDraw(doc, C.line); doc.setLineWidth(0.5);
  doc.line(M + colW, y + 14, M + colW, y + cardClienteH - 14);

  // Coluna direita — Consultor + dados institucionais (compactado)
  const rx = M + colW + padX;
  let ry = y + 18;
  doc.setFont("helvetica", "bold"); doc.setFontSize(7); setText(doc, C.accentDark);
  doc.text("SEU CONSULTOR", rx, ry);
  ry += 13;

  doc.setFont("helvetica", "bold"); doc.setFontSize(12); setText(doc, C.ink);
  doc.text(vendedorNome, rx, ry);
  ry += 10;

  // Divisor sutil entre consultor e empresa
  setDraw(doc, C.line); doc.setLineWidth(0.5);
  doc.line(rx, ry, rx + colW - padX * 2, ry);
  ry += 11;

  doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); setText(doc, C.ink);
  doc.text("Comércio de Utilidades Lukati LTDA", rx, ry);
  ry += 11;

  doc.setFont("helvetica", "normal"); doc.setFontSize(7); setText(doc, C.muted);
  doc.text("Matriz Içara/SC", rx, ry);
  doc.setFont("helvetica", "bold"); setText(doc, C.body);
  doc.text("CNPJ 43.956.926/0001-68", rx + colW - padX * 2, ry, { align: "right" });
  ry += 10;

  doc.setFont("helvetica", "normal"); setText(doc, C.muted);
  doc.text("Filial Guarulhos/SP", rx, ry);
  doc.setFont("helvetica", "bold"); setText(doc, C.body);
  doc.text("CNPJ 43.956.926/0002-49", rx + colW - padX * 2, ry, { align: "right" });

  y += cardClienteH + 12;

  // (Diferenciais movidos para o rodapé como selos institucionais)



  // ── PRODUTOS ─────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold"); doc.setFontSize(10); setText(doc, C.ink);
  doc.text("ITENS DA PROPOSTA", M, y);
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); setText(doc, C.muted);
  doc.text(`${orc.itens.length} ${orc.itens.length === 1 ? "item" : "itens"}`, W - M, y, { align: "right" });
  y += 12;

  // Cards mais compactos quando há até 2 itens (prioriza 1 página)
  const compact = orc.itens.length <= 2;
  const cardHBase = compact ? 96 : 108;
  const imgSize = compact ? 78 : 92;
  const imgX = M + 12;

  for (const item of orc.itens) {
    const obs = (item as any).observacao as string | undefined;
    const hasObs = !!(obs && obs.trim());
    const cardH = cardHBase + (hasObs ? 14 : 0);

    y = ensureSpace(doc, y, cardH + 8);

    // Sombra simulada + card branco com borda navy fina
    setFill(doc, [230, 234, 240]);
    doc.roundedRect(M + 1, y + 3, W - M * 2, cardH, 12, 12, "F");
    setFill(doc, C.white);
    setDraw(doc, C.ink); doc.setLineWidth(0.5);
    doc.roundedRect(M, y, W - M * 2, cardH, 12, 12, "FD");

    // Imagem com placeholder
    const imgSrc = item.mockupImagem || item.imagem;
    let hasImg = false;
    if (imgSrc) {
      const img = await loadImageAsDataURL(imgSrc);
      if (img) {
        try {
          setFill(doc, C.surface);
          doc.roundedRect(imgX, y + 9, imgSize, imgSize, 6, 6, "F");
          doc.addImage(img, "JPEG", imgX + 2, y + 11, imgSize - 4, imgSize - 4, undefined, "FAST");
          hasImg = true;
        } catch { /* ignore */ }
      }
    }
    if (!hasImg) {
      setFill(doc, C.surface);
      doc.roundedRect(imgX, y + 9, imgSize, imgSize, 6, 6, "F");
      doc.setFont("helvetica", "normal"); doc.setFontSize(7); setText(doc, C.subtle);
      doc.text("Sem imagem", imgX + imgSize / 2, y + 9 + imgSize / 2 + 2, { align: "center" });
    }

    const tx = imgX + imgSize + 16;
    const txW = W - M - tx - 14;

    // Nome
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); setText(doc, C.ink);
    const nameLines = doc.splitTextToSize(item.nome, txW);
    doc.text(nameLines.slice(0, 2), tx, y + 22);
    const afterName = y + 22 + (nameLines.length > 1 ? 24 : 13);

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
    const qtdY = afterName + 15;
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); setText(doc, C.muted);
    const qLabel = `Quantidade: `;
    doc.text(qLabel, tx, qtdY);
    doc.setFont("helvetica", "bold"); setText(doc, C.body);
    doc.text(`${item.quantidade} un.`, tx + doc.getTextWidth(qLabel), qtdY);

    // OBS opcional (apenas se preenchido)
    if (hasObs) {
      const obsY = qtdY + 13;
      doc.setFont("helvetica", "bold"); doc.setFontSize(6.8); setText(doc, C.accentDark);
      doc.text("OBS:", tx, obsY);
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.8); setText(doc, C.body);
      const obsLines = doc.splitTextToSize(obs!.trim(), txW - 28);
      doc.text(obsLines.slice(0, 1), tx + 22, obsY);
    }

    // Unitário
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); setText(doc, C.muted);
    doc.text("Valor unitário", tx, y + cardH - 15);
    doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); setText(doc, C.body);
    doc.text(fmtBRL(item.precoUnitario), tx, y + cardH - 5);

    // Total à direita
    const rows = (item as any).tabelaPrecos && (item as any).precoCusto
      ? getNormalizedPriceRows((item as any).tabelaPrecos, (item as any).precoCusto)
      : null;
    const basePriceItem = rows && rows.length
      ? rows[0].unit
      : (item.precoOriginal ?? item.precoUnitario);
    const totalItem = item.precoUnitario * item.quantidade;
    const originalItem = basePriceItem * item.quantidade;
    const temDesconto = originalItem > totalItem + 0.01;

    doc.setFont("helvetica", "normal"); doc.setFontSize(7); setText(doc, C.subtle);
    doc.text("TOTAL DO ITEM", W - M - 14, y + 20, { align: "right" });

    if (temDesconto) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); setText(doc, C.subtle);
      const origStr = fmtBRL(originalItem);
      doc.text(origStr, W - M - 14, y + 34, { align: "right" });
      const origW = doc.getTextWidth(origStr);
      setDraw(doc, C.subtle); doc.setLineWidth(0.6);
      doc.line(W - M - 14 - origW, y + 31.5, W - M - 14, y + 31.5);
    }

    doc.setFont("helvetica", "bold"); doc.setFontSize(15); setText(doc, C.ink);
    doc.text(fmtBRL(totalItem), W - M - 14, temDesconto ? y + 56 : y + 44, { align: "right" });

    y += cardH + 8;
  }

  // ── TOTAIS ───────────────────────────────────────────────────────────────
  const subtotal = orc.subtotal ?? orc.itens.reduce((s, i) => s + i.precoUnitario * i.quantidade, 0);
  // Economia correta: compara contra o preço da menor faixa da tabela (qtd mínima),
  // não contra o "precoOriginal" (que é o automático para a qtd atual).
  const subtotalOriginal = orc.itens.reduce((s, i) => {
    const rs = (i as any).tabelaPrecos && (i as any).precoCusto
      ? getNormalizedPriceRows((i as any).tabelaPrecos, (i as any).precoCusto)
      : null;
    const base = rs && rs.length ? rs[0].unit : (i.precoOriginal ?? i.precoUnitario);
    return s + base * i.quantidade;
  }, 0);
  const economia = Math.max(0, subtotalOriginal - subtotal);
  const total = subtotal + (orc.freteValor || 0);
  const totalOriginal = subtotalOriginal + (orc.freteValor || 0);

  const totalBoxH = economia > 0 ? 112 : 82;
  y = ensureSpace(doc, y + 4, totalBoxH + 16);

  // Frete (linha discreta acima do total)
  if (orc.freteValor && orc.freteValor > 0) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); setText(doc, C.muted);
    doc.text(`Frete (${orc.freteTipo || "—"})`, W - M - 200, y);
    doc.text(fmtBRL(orc.freteValor), W - M, y, { align: "right" });
    y += 12;
  }
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); setText(doc, C.muted);
  doc.text("Subtotal dos itens", W - M - 200, y);
  doc.text(fmtBRL(subtotal), W - M, y, { align: "right" });
  y += 12;

  // Box do total — branco com contorno navy premium
  setFill(doc, C.white);
  setDraw(doc, C.ink); doc.setLineWidth(1.4);
  doc.roundedRect(M, y, W - M * 2, totalBoxH, 12, 12, "FD");
  // Linha navy lateral fina
  setFill(doc, C.ink);
  doc.rect(M, y, 4, totalBoxH, "F");

  doc.setFont("helvetica", "normal"); doc.setFontSize(7); setText(doc, C.muted);
  doc.setCharSpace(1.4);
  doc.text("VALOR TOTAL DA PROPOSTA", M + 22, y + 22);
  doc.setCharSpace(0);

  if (economia > 0) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); setText(doc, C.subtle);
    const deStr = `de ${fmtBRL(totalOriginal)}`;
    doc.text(deStr, M + 22, y + 38);
    const deW = doc.getTextWidth(deStr);
    setDraw(doc, C.subtle); doc.setLineWidth(0.6);
    doc.line(M + 22, y + 35.5, M + 22 + deW, y + 35.5);

    doc.setFont("helvetica", "bold"); doc.setFontSize(28); setText(doc, C.ink);
    doc.text(fmtBRL(total), M + 22, y + 70);

    const ecoLabel = `Você economiza ${fmtBRL(economia)}`;
    doc.setFont("helvetica", "bold"); doc.setFontSize(8);
    const ecoW = doc.getTextWidth(ecoLabel) + 18;
    setFill(doc, C.accentSoft);
    doc.roundedRect(M + 22, y + 82, ecoW, 18, 9, 9, "F");
    setText(doc, C.accentDark);
    doc.text(ecoLabel, M + 22 + 9, y + 95);
  } else {
    doc.setFont("helvetica", "bold"); doc.setFontSize(30); setText(doc, C.ink);
    doc.text(fmtBRL(total), M + 22, y + 62);
  }

  // Lado direito: forma resumida (texto em navy)
  doc.setFont("helvetica", "normal"); doc.setFontSize(7); setText(doc, C.muted);
  doc.setCharSpace(1.2);
  doc.text("PAGAMENTO", W - M - 22, y + 22, { align: "right" });
  doc.setCharSpace(0);
  doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); setText(doc, C.ink);
  doc.text(lookupName(sistema.meiosPagamento, orc.pagamentoId), W - M - 22, y + 36, { align: "right" });

  doc.setFont("helvetica", "normal"); doc.setFontSize(7); setText(doc, C.muted);
  doc.setCharSpace(1.2);
  doc.text("VALIDADE", W - M - 22, y + 56, { align: "right" });
  doc.setCharSpace(0);
  doc.setFont("helvetica", "bold"); doc.setFontSize(9.5); setText(doc, C.accentDark);
  doc.text(formatDate(dataValidade.toISOString()), W - M - 22, y + 70, { align: "right" });

  y += totalBoxH + 14;

  // ── CONDIÇÕES (linha discreta) ───────────────────────────────────────────
  y = ensureSpace(doc, y, 50);

  const cards = [
    { label: "PRAZO DE ENTREGA", value: orc.prazoEntrega ? `${orc.prazoEntrega} dias úteis` : "À combinar" },
    { label: "FORMA DE PAGAMENTO", value: lookupName(sistema.meiosPagamento, orc.pagamentoId) },
    { label: "TRANSPORTE", value: orc.freteTipo === "FOB" ? "FOB" : lookupName(sistema.transportadoras, orc.transportadoraId) },
    { label: "VALIDADE", value: formatDate(dataValidade.toISOString()) },
  ];

  const gap = 8;
  const cw = (W - M * 2 - gap * 3) / 4;
  const ch = 38;
  cards.forEach((c, i) => {
    const cx = M + (cw + gap) * i;
    setDraw(doc, C.line); doc.setLineWidth(0.6);
    doc.roundedRect(cx, y, cw, ch, 6, 6, "S");
    doc.setFont("helvetica", "normal"); doc.setFontSize(6); setText(doc, C.subtle);
    doc.setCharSpace(0.8);
    doc.text(c.label, cx + 10, y + 13);
    doc.setCharSpace(0);
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); setText(doc, C.ink);
    const lines = doc.splitTextToSize(c.value, cw - 20);
    doc.text(lines.slice(0, 1), cx + 10, y + 26);
  });
  y += ch + 12;

  // ── OBSERVAÇÕES ──────────────────────────────────────────────────────────
  if (orc.observacoes) {
    y = ensureSpace(doc, y, 50);
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); setText(doc, C.subtle);
    doc.setCharSpace(1);
    doc.text("OBSERVAÇÕES", M, y);
    doc.setCharSpace(0);
    y += 11;
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); setText(doc, C.body);
    const lines = doc.splitTextToSize(orc.observacoes, W - M * 2);
    doc.text(lines, M, y);
    y += lines.length * 11 + 6;
  }

  // ── SELOS INSTITUCIONAIS (rodapé) ────────────────────────────────────────
  y = ensureSpace(doc, y, 38);
  setDraw(doc, C.line); doc.setLineWidth(0.5);
  doc.line(M, y, W - M, y);
  y += 14;
  const seals = ["Produção em até 48h", "Nota Fiscal e Garantia", "Entrega para todo Brasil"];
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); setText(doc, C.muted);
  doc.setCharSpace(0.6);
  const segW = (W - M * 2) / seals.length;
  seals.forEach((s, i) => {
    const cx = M + segW * i + segW / 2;
    // pequeno marcador verde
    setFill(doc, C.accent);
    doc.circle(cx - doc.getTextWidth(s) / 2 - 6, y - 2, 1.3, "F");
    setText(doc, C.muted);
    doc.text(s, cx, y, { align: "center" });
  });
  doc.setCharSpace(0);
  y += 14;

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
