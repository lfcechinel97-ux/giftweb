import { jsPDF } from "jspdf";
import type { Pedido, PedidoItem, Cliente, LookupItem, Transportadora } from "@/contexts/SistemaContext";
import { resumoPersonalizacao } from "@/lib/personalizacao";

/* Ficha OPERACIONAL de produção — não é pedido nem nota.
   A4 retrato, produtos sempre empilhados (nunca lado a lado), no máximo 3
   por folha, cada card com a foto como maior elemento. Fora da folha:
   e-mail, telefone, endereço, vendedor, frete, preço, código. */

interface Sis {
  clientes: Cliente[];
  vendedores: LookupItem[];
  transportadoras: Transportadora[];
}

const AZUL = [20, 100, 210] as const;
const VERDE = [25, 168, 74] as const;
const AZUL_ESCURO = [16, 42, 86] as const;
const CINZA_FUNDO = [245, 247, 250] as const;
const BORDA = [217, 224, 232] as const;
const TEXTO = [23, 32, 51] as const;
const TEXTO_FRACO = [110, 122, 140] as const;

const MARGEM = 30;
const ESPACO_CARD = 12;
const MAX_POR_PAGINA = 3;

/* Uma imagem que não responde não pode impedir a folha de sair: sem
   timeout o download inteiro fica pendurado e nada é gerado. */
async function loadImageAsDataURL(src: string): Promise<string | null> {
  if (!src) return null;
  if (src.startsWith("data:")) return src;
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

/* Cor/variação: o nome do produto quase sempre já termina nela
   ("CANETA METAL TOUCH - AZUL" -> "AZUL"). O slug da variante costuma
   repetir o produto inteiro ("caneta-metal-touch-08103-azul"), então só
   entra quando sobra algo curto depois de tirar o que já está no nome. */
const variacaoDoItem = (nome: string, slug?: string): string => {
  const partes = nome.split(/\s+[-–]\s+/);
  if (partes.length > 1) {
    const ultima = partes[partes.length - 1].trim();
    if (ultima && ultima.split(/\s+/).length <= 4) return ultima;
  }
  if (!slug) return "";
  const palavrasDoNome = new Set(
    nome.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").split(/[^a-z0-9]+/),
  );
  const resto = slug.split(/[-_]/)
    .filter(p => p && !palavrasDoNome.has(p) && !/^\d+$/.test(p))
    .map(p => p.charAt(0).toUpperCase() + p.slice(1));
  return resto.length > 0 && resto.length <= 3 ? resto.join(" ") : "";
};

interface ItemPreparado {
  item: PedidoItem;
  indice: number;
  imagem: string | null;
  personalizacao: string;
  variacao: string;
}

export async function gerarOrdemProducaoPDF(pedido: Pedido, sis: Sis): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const larguraUtil = W - MARGEM * 2;

  const cliente = sis.clientes.find(c => c.id === pedido.clienteId);
  const clienteNome = cliente?.nome || pedido.clienteSnapshot?.nome || pedido.contatoNome || "—";
  const dataPedido = new Date(pedido.createdAt).toLocaleDateString("pt-BR");
  const dataDespacho = pedido.dataDespacharAte
    ? new Date(`${String(pedido.dataDespacharAte).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR")
    : "A definir";
  const observacoesVendedor = (pedido.observacoes || "").trim();

  const preparados: ItemPreparado[] = [];
  for (let i = 0; i < pedido.itens.length; i++) {
    const item = pedido.itens[i];
    const src = item.mockupImagem || item.imagem || "";
    preparados.push({
      item,
      indice: i + 1,
      imagem: src ? await loadImageAsDataURL(src) : null,
      personalizacao: [resumoPersonalizacao(item), (item.observacao || "").trim()]
        .filter(Boolean).join("\n"),
      variacao: variacaoDoItem(item.nome, item.varianteSlug),
    });
  }

  /* ── Cabeçalho ──────────────────────────────────────────────────────── */
  const desenharCabecalho = (compacto: boolean): number => {
    const alturaTitulo = compacto ? 0 : 34;
    const alturaFaixa = 46;
    const altura = alturaTitulo + alturaFaixa;
    const topo = MARGEM;

    if (!compacto) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(...AZUL);
      doc.text("GIFTWEB BRINDES", MARGEM, topo + 10);

      doc.setFontSize(17);
      doc.setTextColor(...AZUL_ESCURO);
      doc.text("ORDEM DE PRODUÇÃO", MARGEM, topo + 28);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...TEXTO_FRACO);
      doc.text("PEDIDO Nº", W - MARGEM, topo + 8, { align: "right" });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(26);
      doc.setTextColor(...AZUL_ESCURO);
      doc.text(pedido.numero, W - MARGEM, topo + 30, { align: "right" });
    }

    // Faixa com as informações que a produção precisa bater o olho.
    const faixaY = topo + alturaTitulo;
    doc.setFillColor(...CINZA_FUNDO);
    doc.setDrawColor(...BORDA);
    doc.roundedRect(MARGEM, faixaY, larguraUtil, alturaFaixa, 5, 5, "FD");

    const celulas: { rotulo: string; valor: string; destaque?: boolean; peso: number }[] = compacto
      ? [
          { rotulo: "PEDIDO Nº", valor: pedido.numero, peso: 1, destaque: true },
          { rotulo: "DATA PARA DESPACHAR", valor: dataDespacho, peso: 1.1, destaque: true },
          { rotulo: "CLIENTE", valor: clienteNome, peso: 1.6 },
        ]
      : [
          { rotulo: "DATA PARA DESPACHAR", valor: dataDespacho, peso: 1.1, destaque: true },
          { rotulo: "CLIENTE", valor: clienteNome, peso: 1.9 },
          { rotulo: "DATA DO PEDIDO", valor: dataPedido, peso: 1 },
        ];

    const pesoTotal = celulas.reduce((s, c) => s + c.peso, 0);
    let x = MARGEM;
    celulas.forEach((c, i) => {
      const largura = (larguraUtil * c.peso) / pesoTotal;
      if (i > 0) {
        doc.setDrawColor(...BORDA);
        doc.line(x, faixaY + 8, x, faixaY + alturaFaixa - 8);
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...TEXTO_FRACO);
      doc.text(c.rotulo, x + 12, faixaY + 16);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(c.destaque ? 13 : 11.5);
      if (c.destaque) doc.setTextColor(...VERDE); else doc.setTextColor(...TEXTO);
      const linhas = doc.splitTextToSize(c.valor, largura - 22) as string[];
      doc.text(linhas[0] ?? "—", x + 12, faixaY + 34);
      x += largura;
    });

    return topo + altura + 14;
  };

  /* ── Medição do bloco de texto do card ──────────────────────────────── */
  const alturaTextoItem = (p: ItemPreparado, largura: number, fs: number): number => {
    doc.setFontSize(fs);
    let h = 0;
    const bloco = (titulo: string, corpo: string, fsCorpo: number) => {
      if (!corpo) return;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(fsCorpo);
      const linhas = doc.splitTextToSize(corpo, largura) as string[];
      h += (fs + 6) + linhas.length * (fsCorpo + 2.5) + 12;
    };
    bloco("PERSONALIZAÇÃO", p.personalizacao || "—", fs);
    h += (fs + 6) + (fs + 22);                    // quantidade
    if (p.variacao) h += (fs + 6) + (fs + 14);    // cor/variação
    bloco("OBSERVAÇÕES DO VENDEDOR", observacoesVendedor, fs - 0.5);
    return h;
  };

  /* ── Desenho de um card ─────────────────────────────────────────────── */
  const desenharCard = (p: ItemPreparado, y: number, altura: number, fs: number, fatiaImagem: number) => {
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...BORDA);
    doc.roundedRect(MARGEM, y, larguraUtil, altura, 6, 6, "FD");

    const padding = 12;
    const interno = larguraUtil - padding * 2;

    // Título: círculo verde com o número + nome do produto
    const tituloY = y + padding + 9;
    doc.setFillColor(...VERDE);
    doc.circle(MARGEM + padding + 9, tituloY - 3, 9, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(String(p.indice), MARGEM + padding + 9, tituloY, { align: "center" });

    doc.setFontSize(fs + 2.5);
    doc.setTextColor(...AZUL_ESCURO);
    const nomeLinhas = doc.splitTextToSize(p.item.nome, interno - 28) as string[];
    doc.text(nomeLinhas[0], MARGEM + padding + 24, tituloY);

    const conteudoY = y + padding + 26;
    const conteudoH = altura - (conteudoY - y) - padding;

    // Foto: maior elemento do card, sem distorcer e sem cortar.
    const imgArea = { x: MARGEM + padding, y: conteudoY, w: interno * fatiaImagem, h: conteudoH };
    doc.setFillColor(252, 253, 254);
    doc.setDrawColor(...BORDA);
    doc.roundedRect(imgArea.x, imgArea.y, imgArea.w, imgArea.h, 4, 4, "FD");

    if (p.imagem) {
      try {
        const props = doc.getImageProperties(p.imagem);
        /* Proporção original sempre, e nunca ampliar além do que a imagem
           aguenta: o teto de 0,48 pt por pixel mantém no mínimo 150 dpi no
           papel — esticar um mockup pequeno só deixaria a arte borrada. */
        const TETO_AMPLIACAO = 0.48;
        const escala = Math.min(
          (imgArea.w - 10) / props.width,
          (imgArea.h - 10) / props.height,
          TETO_AMPLIACAO,
        );
        const w = props.width * escala;
        const h = props.height * escala;
        doc.addImage(
          p.imagem, imgArea.x + (imgArea.w - w) / 2, imgArea.y + (imgArea.h - h) / 2, w, h,
          undefined, "FAST",
        );
      } catch { /* imagem inválida: a área fica vazia, sem quebrar a folha */ }
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...TEXTO_FRACO);
      doc.text("sem mockup", imgArea.x + imgArea.w / 2, imgArea.y + imgArea.h / 2, { align: "center" });
    }

    // Informações
    const infoX = imgArea.x + imgArea.w + 14;
    const infoW = interno - imgArea.w - 14;
    let iy = conteudoY + 2;

    const rotulo = (texto: string) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(...TEXTO_FRACO);
      doc.text(texto, infoX, iy);
      iy += fs + 6;            // respiro entre o rótulo e o valor
    };

    rotulo("PERSONALIZAÇÃO");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fs);
    doc.setTextColor(...TEXTO);
    const linhasPers = doc.splitTextToSize(p.personalizacao || "—", infoW) as string[];
    for (const linha of linhasPers) {
      doc.text(linha, infoX, iy);
      iy += fs + 2.5;
    }
    iy += 12;

    rotulo("QUANTIDADE");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(fs + 7);
    doc.setTextColor(...AZUL);
    doc.text(`${p.item.quantidade} un.`, infoX, iy + 3);
    iy += fs + 22;

    if (p.variacao) {
      rotulo("COR / VARIAÇÃO");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(fs);
      doc.setTextColor(...TEXTO);
      doc.text(p.variacao, infoX, iy);
      iy += fs + 14;
    }

    if (observacoesVendedor) {
      rotulo("OBSERVAÇÕES DO VENDEDOR");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(fs - 0.5);
      doc.setTextColor(...TEXTO);
      const linhasObs = doc.splitTextToSize(observacoesVendedor, infoW) as string[];
      for (const linha of linhasObs) {
        doc.text(linha, infoX, iy);
        iy += fs + 2;
      }
    }
  };

  /* ── Paginação: até 3 por folha, e só o que couber inteiro ──────────── */
  const alturaDisponivel = (compacto: boolean) =>
    H - MARGEM - (MARGEM + (compacto ? 46 : 80) + 14);

  const paginas: ItemPreparado[][] = [];
  let pagina: ItemPreparado[] = [];
  let usado = 0;
  preparados.forEach((p, i) => {
    const compacto = paginas.length > 0;
    const disponivel = alturaDisponivel(compacto);
    // Altura mínima confortável: foto legível + texto completo.
    const necessario = Math.max(150, alturaTextoItem(p, larguraUtil * 0.35, 9) + 50);
    const cabe = pagina.length < MAX_POR_PAGINA
      && usado + necessario + (pagina.length ? ESPACO_CARD : 0) <= disponivel;
    if (!cabe && pagina.length > 0) {
      paginas.push(pagina);
      pagina = [];
      usado = 0;
    }
    pagina.push(p);
    usado += necessario + (pagina.length > 1 ? ESPACO_CARD : 0);
    if (i === preparados.length - 1) paginas.push(pagina);
  });

  paginas.forEach((itensDaPagina, idx) => {
    if (idx > 0) doc.addPage();
    const compacto = idx > 0;
    const y0 = desenharCabecalho(compacto);
    const disponivel = H - MARGEM - y0;
    const n = itensDaPagina.length;
    const alturaCard = (disponivel - ESPACO_CARD * (n - 1)) / n;
    const fs = n === 1 ? 11 : n === 2 ? 10 : 9;
    const fatiaImagem = n === 1 ? 0.58 : n === 2 ? 0.48 : 0.42;

    let y = y0;
    for (const p of itensDaPagina) {
      desenharCard(p, y, alturaCard, fs, fatiaImagem);
      y += alturaCard + ESPACO_CARD;
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...TEXTO_FRACO);
    doc.text(
      `Pedido ${pedido.numero} · Página ${idx + 1} de ${paginas.length}`,
      W - MARGEM, H - 14, { align: "right" },
    );
  });

  doc.save(`OrdemProducao_${pedido.numero}.pdf`);
}
