import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Orcamento, Cliente, LookupItem } from "@/contexts/SistemaContext";

interface Sis {
  clientes: Cliente[];
  vendedores: LookupItem[];
  meiosPagamento: LookupItem[];
  transportadoras: LookupItem[];
  origens: LookupItem[];
}

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

function drawLogoText(doc: jsPDF, x: number, y: number) {
  // Ícone presente estilizado (caixa + laço) usando linhas
  const bx = x, by = y - 12, bw = 16, bh = 13;
  doc.setDrawColor(255, 255, 255);
  doc.setLineWidth(1.5);
  // Caixa
  doc.rect(bx, by + 4, bw, bh, "S");
  // Laço superior
  doc.setLineWidth(1.2);
  doc.line(bx + bw / 2, by + 4, bx + bw / 2, by);
  // Arcos do laço (simulados com curvas)
  doc.line(bx + bw / 2, by, bx + bw / 2 - 5, by - 4);
  doc.line(bx + bw / 2, by, bx + bw / 2 + 5, by - 4);
  // Faixa central
  doc.line(bx, by + 4 + bh / 2, bx + bw, by + 4 + bh / 2);
  // Texto GIFT WEB
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text("GIFT WEB", bx + bw + 8, y);
  // Subtítulo
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(200, 200, 200);
  doc.text("BRINDES PERSONALIZADOS", bx + bw + 8, y + 13);
}

function drawClienteBlock(doc: jsPDF, cliente: Cliente | undefined, orc: Orcamento, vendedorNome: string, y: number): number {
  doc.setFillColor(248, 249, 252);
  const blockH = 72;
  doc.roundedRect(30, y, doc.internal.pageSize.getWidth() - 60, blockH, 4, 4, "F");

  // Linha divisória vertical
  const midX = 30 + (doc.internal.pageSize.getWidth() - 60) / 2;
  doc.setDrawColor(220, 220, 230);
  doc.setLineWidth(0.5);
  doc.line(midX, y + 8, midX, y + blockH - 8);

  // Coluna esquerda: dados do cliente
  doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(140, 140, 160);
  doc.text("CLIENTE", 44, y + 16);

  doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(20, 20, 40);
  doc.text(cliente?.nome || orc.contatoNome || "—", 44, y + 30);

  const docLabel = cliente?.tipo === "PJ" ? "CNPJ:" : "CPF:";
  const docValue = cliente?.documento
    ? (cliente.tipo === "PJ"
        ? cliente.documento.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")
        : cliente.documento.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4"))
    : "—";

  doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(80, 80, 100);
  doc.text(`${docLabel} ${docValue}`, 44, y + 43);

  // Contato
  const contatoTel = orc.contatoTelefone || cliente?.contatos?.[0]?.telefone || "";
  const contatoEmail = orc.contatoEmail || cliente?.contatos?.[0]?.email || "";
  const contatoNome = orc.contatoNome || cliente?.contatos?.[0]?.nome || "";
  const linhaContato = [contatoNome, contatoTel, contatoEmail].filter(Boolean).join("  ·  ");
  if (linhaContato) {
    doc.setFontSize(8); doc.setTextColor(80, 80, 100);
    doc.text(linhaContato, 44, y + 56);
  }

  // Coluna direita: vendedor e origem
  doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(140, 140, 160);
  doc.text("VENDEDOR", midX + 14, y + 16);
  doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(20, 20, 40);
  doc.text(vendedorNome, midX + 14, y + 30);

  return y + blockH + 14;
}

export async function gerarPDFOrcamento(orc: Orcamento, sis?: Sis, clienteNome?: string): Promise<void> {
  const sistema = sis || { clientes: [], vendedores: [], meiosPagamento: [], transportadoras: [], origens: [] };
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();

  // ── Cabeçalho ──────────────────────────────────────────────────────────────
  doc.setFillColor(18, 18, 30);
  doc.rect(0, 0, W, 85, "F");

  // Faixa decorativa verde na base do header
  doc.setFillColor(34, 197, 94);
  doc.rect(0, 82, W, 3, "F");

  // Logo
  drawLogoText(doc, 35, 46);

  // Lado direito: Orçamento
  doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(160, 160, 180);
  doc.text("ORÇAMENTO", W - 40, 28, { align: "right" });

  doc.setFontSize(22); doc.setFont("helvetica", "bold"); doc.setTextColor(255, 255, 255);
  doc.text(`#${orc.numero}`, W - 40, 52, { align: "right" });

  doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(160, 160, 180);
  doc.text(formatDate(orc.createdAt), W - 40, 68, { align: "right" });

  // ── Bloco cliente ──────────────────────────────────────────────────────────
  const cliente = sistema.clientes.find(c => c.id === orc.clienteId);
  const vendedorNome = lookupName(sistema.vendedores, orc.vendedorId);
  let y = drawClienteBlock(doc, cliente, orc, vendedorNome, 102);

  // ── Produto em destaque (1º item) ──────────────────────────────────────────
  const destaque = orc.itens[0];
  if (destaque) {
    doc.setFillColor(241, 243, 250);
    doc.roundedRect(30, y, W - 60, 118, 4, 4, "F");

    const imgSrc = destaque.mockupImagem || destaque.imagem;
    if (imgSrc) {
      const img = await loadImageAsDataURL(imgSrc);
      if (img) {
        try { doc.addImage(img, "JPEG", 44, y + 10, 90, 90, undefined, "FAST"); } catch { /* ignore */ }
      }
    }

    const txtX = imgSrc ? 148 : 44;
    doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(140, 140, 160);
    doc.text("PRODUTO EM DESTAQUE", txtX, y + 22);

    doc.setFontSize(13); doc.setFont("helvetica", "bold"); doc.setTextColor(20, 20, 40);
    const nameLines = doc.splitTextToSize(destaque.nome, W - txtX - 60);
    doc.text(nameLines.slice(0, 2), txtX, y + 38);

    doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 100, 120);
    doc.text(destaque.codigoComposto || "", txtX, y + 66);
    doc.text(`${destaque.quantidade} unidades`, txtX, y + 80);

    doc.setFontSize(17); doc.setFont("helvetica", "bold"); doc.setTextColor(34, 197, 94);
    doc.text(fmtBRL(destaque.precoUnitario * destaque.quantidade), txtX, y + 100);

    doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(130, 130, 150);
    doc.text(`Unitário: ${fmtBRL(destaque.precoUnitario)}`, txtX + 110, y + 100);

    y += 132;
  }

  // ── Tabela demais itens ────────────────────────────────────────────────────
  const restantes = orc.itens.slice(1);
  if (restantes.length) {
    autoTable(doc, {
      startY: y,
      margin: { left: 30, right: 30 },
      head: [["Código", "Produto", "Qtd", "Unitário", "Total"]],
      body: restantes.map(i => [
        i.codigoComposto || "",
        i.nome,
        String(i.quantidade),
        fmtBRL(i.precoUnitario),
        fmtBRL(i.precoUnitario * i.quantidade),
      ]),
      headStyles: { fillColor: [18, 18, 30], textColor: 255, fontSize: 8, fontStyle: "bold" },
      bodyStyles: { fontSize: 8.5, textColor: [40, 40, 60] },
      alternateRowStyles: { fillColor: [248, 249, 252] },
      columnStyles: {
        0: { cellWidth: 100 },
        2: { halign: "right", cellWidth: 40 },
        3: { halign: "right", cellWidth: 75 },
        4: { halign: "right", cellWidth: 80, fontStyle: "bold" },
      },
      theme: "plain",
    });
    y = (doc as any).lastAutoTable.finalY + 12;
  }

  // ── Totais ─────────────────────────────────────────────────────────────────
  if (y > 660) { doc.addPage(); y = 50; }

  const subtotal = orc.subtotal ?? orc.itens.reduce((s, i) => s + i.precoUnitario * i.quantidade, 0);
  const total = subtotal + (orc.freteValor || 0);

  const totW = 200;
  const totX = W - 30 - totW;

  doc.setDrawColor(220, 220, 230); doc.setLineWidth(0.5);
  doc.line(totX, y, W - 30, y);
  y += 10;

  doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(90, 90, 110);
  doc.text("Subtotal:", totX, y); doc.text(fmtBRL(subtotal), W - 30, y, { align: "right" });
  y += 14;

  if (orc.freteValor > 0) {
    doc.text(`Frete ${orc.freteTipo || ""}:`, totX, y);
    doc.text(fmtBRL(orc.freteValor), W - 30, y, { align: "right" });
    y += 14;
  }

  // Barra total
  y += 4;
  doc.setFillColor(18, 18, 30);
  doc.roundedRect(30, y, W - 60, 38, 4, 4, "F");
  doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(200, 200, 210);
  doc.text("TOTAL GERAL", 46, y + 23);
  doc.setFontSize(17); doc.setFont("helvetica", "bold"); doc.setTextColor(34, 197, 94);
  doc.text(fmtBRL(total), W - 46, y + 24, { align: "right" });
  y += 52;

  // ── Condições ─────────────────────────────────────────────────────────────
  if (y > 700) { doc.addPage(); y = 50; }

  const dataValidade = new Date(orc.createdAt);
  dataValidade.setDate(dataValidade.getDate() + 15);

  const cols = [
    { label: "ENTREGA",    value: orc.prazoEntrega ? `${orc.prazoEntrega} dias úteis` : "À combinar" },
    { label: "VALIDADE",   value: formatDate(dataValidade.toISOString()) },
    { label: "PAGAMENTO",  value: lookupName(sistema.meiosPagamento, orc.pagamentoId) },
    { label: "TRANSPORTE", value: orc.freteTipo === "FOB" ? "FOB (Cliente retira)" : lookupName(sistema.transportadoras, orc.transportadoraId) },
  ];

  const colW = (W - 60) / 4;
  cols.forEach((col, i) => {
    const cx = 30 + i * colW;
    doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(140, 140, 160);
    doc.text(col.label, cx, y);
    doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(20, 20, 40);
    doc.text(col.value, cx, y + 13);
  });
  y += 30;

  // ── Observações ────────────────────────────────────────────────────────────
  if (orc.observacoes) {
    if (y > 700) { doc.addPage(); y = 50; }
    doc.setDrawColor(220, 220, 230); doc.setLineWidth(0.5);
    doc.line(30, y + 4, W - 30, y + 4);
    y += 14;
    doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(140, 140, 160);
    doc.text("OBSERVAÇÕES", 30, y);
    doc.setFontSize(8.5); doc.setTextColor(50, 50, 70);
    const lines = doc.splitTextToSize(orc.observacoes, W - 60);
    doc.text(lines, 30, y + 13);
  }

  // ── Rodapé ─────────────────────────────────────────────────────────────────
  const ph = doc.internal.pageSize.getHeight();
  doc.setFillColor(18, 18, 30);
  doc.rect(0, ph - 28, W, 28, "F");
  doc.setFontSize(7.5); doc.setFont("helvetica", "normal"); doc.setTextColor(160, 160, 180);
  doc.text("Gift Web Brindes Personalizados  ·  contato@giftweb.com.br  ·  giftweb.com.br", W / 2, ph - 12, { align: "center" });

  const nomeCliente = clienteNome
    ? clienteNome.replace(/[^a-zA-Z0-9\u00C0-\u024F\s]/g, "").trim().replace(/\s+/g, "_")
    : "Cliente";
  doc.save(`Orcamento_${nomeCliente}_${orc.numero}.pdf`);
}

export async function gerarPDFPedido(pedido: any, sis?: Sis): Promise<void> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();

  doc.setFillColor(18, 18, 30);
  doc.rect(0, 0, W, 85, "F");
  doc.setFillColor(34, 197, 94);
  doc.rect(0, 82, W, 3, "F");

  drawLogoText(doc, 35, 46);

  doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(160, 160, 180);
  doc.text("PEDIDO", W - 40, 28, { align: "right" });
  doc.setFontSize(22); doc.setFont("helvetica", "bold"); doc.setTextColor(255, 255, 255);
  doc.text(`#${pedido.numero}`, W - 40, 52, { align: "right" });
  doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(160, 160, 180);
  doc.text(formatDate(pedido.createdAt), W - 40, 68, { align: "right" });

  doc.save(`pedido-${pedido.numero}.pdf`);
}
