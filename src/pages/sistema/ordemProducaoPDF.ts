import { jsPDF } from "jspdf";
import type { Pedido, Cliente, LookupItem, Transportadora } from "@/contexts/SistemaContext";

interface Sis {
  clientes: Cliente[];
  vendedores: LookupItem[];
  transportadoras: Transportadora[];
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

export async function gerarOrdemProducaoPDF(pedido: Pedido, sis: Sis): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();

  const cliente = sis.clientes.find(c => c.id === pedido.clienteId);
  const vendedor = sis.vendedores.find(v => v.id === pedido.vendedorId);
  const transportadora = sis.transportadoras.find(t => t.id === pedido.transportadoraId);

  const dataPedido = new Date(pedido.createdAt).toLocaleDateString("pt-BR");
  const contato = cliente?.contatos?.[0];
  const endereco = cliente?.enderecos?.[0];

  const enderecoStr = endereco
    ? [
        endereco.logradouro,
        endereco.numero,
        endereco.complemento,
        endereco.bairro,
        `${endereco.cidade} / ${endereco.uf}`,
      ].filter(Boolean).join(", ")
    : "—";

  const entregaStr = transportadora
    ? `${transportadora.tipoFrete || ""} - ${transportadora.nome}`.trim().replace(/^-\s*/, "")
    : pedido.freteTipo || "—";

  // ── Per item: one page each ──────────────────────────────────────────────
  for (let itemIdx = 0; itemIdx < pedido.itens.length; itemIdx++) {
    const item = pedido.itens[itemIdx];

    if (itemIdx > 0) doc.addPage();

    let y = 32;
    const pad = 32;

    // ── Header box ──────────────────────────────────────────────────────
    const headerH = 140;
    doc.setFillColor(248, 249, 250);
    doc.setDrawColor(220, 220, 220);
    doc.roundedRect(pad, y, W - pad * 2, headerH, 4, 4, "FD");

    // "Ordem de Produção" title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(30, 30, 30);
    doc.text("Ordem de Produção", pad + 12, y + 20);

    // "PRODUÇÃO" badge top-right
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text("PRODUÇÃO", W - pad - 12, y + 20, { align: "right" });

    // Pedido + Data center
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    const metaText = `Pedido Nº `;
    const metaX = W / 2 - 60;
    doc.text(metaText, metaX, y + 20);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text(pedido.numero, metaX + doc.getTextWidth(metaText), y + 20);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(`  |  Data ${dataPedido}`, metaX + doc.getTextWidth(metaText) + doc.getTextWidth(pedido.numero), y + 20);

    // Divider
    doc.setDrawColor(200, 200, 200);
    doc.line(pad + 12, y + 28, W - pad - 12, y + 28);

    // Client data
    y += 38;
    const col1X = pad + 12;
    const lineH = 16;

    const field = (label: string, value: string, cy: number) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(30, 30, 30);
      doc.text(`${label}: `, col1X, cy);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 60);
      doc.text(value, col1X + doc.getTextWidth(`${label}: `), cy);
    };

    field("Cliente", cliente?.nome || "—", y);
    y += lineH;
    field("E-mail", contato?.email || "—", y);
    y += lineH;
    field("Telefone", contato?.telefone || "—", y);
    y += lineH;
    field("Endereço", enderecoStr, y);
    y += lineH;
    field("Vendedor", vendedor?.nome || "—", y);
    y += lineH;
    field("Entrega", entregaStr, y);

    // ── Item number + name ───────────────────────────────────────────────
    y = 32 + headerH + 20;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30, 30, 30);
    doc.text(`Item Nº: ${itemIdx + 1}`, pad, y);
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.text(`Produto: `, pad, y);
    doc.setFont("helvetica", "bold");
    doc.text(item.nome, pad + doc.getTextWidth("Produto: "), y);
    if (item.codigoComposto) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(`  [${item.codigoComposto}]`, pad + doc.getTextWidth("Produto: ") + doc.getTextWidth(item.nome), y);
    }

    // ── Detail box ───────────────────────────────────────────────────────
    y += 12;
    const boxX = pad;
    const boxW = W - pad * 2;

    // Load image
    const imgSrc = item.mockupImagem || "";
    const imgData = imgSrc ? await loadImageAsDataURL(imgSrc) : null;

    const imgW = 180;
    const imgH = 180;
    const boxContentH = 18 + 18 + 18 + (imgData ? imgH + 10 : 0) + 20;

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(210, 210, 210);
    doc.roundedRect(boxX, y, boxW, boxContentH, 4, 4, "FD");

    let by = y + 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text(`Quantidade: ${item.quantidade} (unidades)`, boxX + 12, by);
    by += 16;

    // prazoEntrega from pedido
    const prazo = pedido.prazoEntrega;
    if (prazo) {
      const dataEntrega = new Date();
      dataEntrega.setDate(dataEntrega.getDate() + prazo);
      doc.text(`Data de Entrega: ${dataEntrega.toLocaleDateString("pt-BR")}`, boxX + 12, by);
    } else {
      doc.text("Data de Entrega: A combinar", boxX + 12, by);
    }
    by += 16;

    if (imgData) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(30, 30, 30);
      doc.text("Desenho:", boxX + 12, by);
      by += 10;

      // Box around image
      doc.setDrawColor(180, 180, 180);
      doc.setFillColor(250, 250, 250);
      doc.rect(boxX + 12, by, imgW + 8, imgH + 8, "FD");
      doc.addImage(imgData, "JPEG", boxX + 16, by + 4, imgW, imgH);
    } else if (imgSrc === "") {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(160, 160, 160);
      doc.text("Desenho: (sem imagem)", boxX + 12, by);
    }

    // ── Observations ────────────────────────────────────────────────────
    if (pedido.observacoes) {
      by = y + boxContentH + 16;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(30, 30, 30);
      doc.text("Observações:", pad, by);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 60);
      const lines = doc.splitTextToSize(pedido.observacoes, W - pad * 2 - 80);
      doc.text(lines, pad + doc.getTextWidth("Observações: "), by);
    }
  }

  doc.save(`OrdemProducao_${pedido.numero}.pdf`);
}
