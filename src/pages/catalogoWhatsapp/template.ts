/**
 * Template visual do catálogo de WhatsApp (1080x1350).
 *
 * Fonte da verdade: template-catalogo.html (referência exemplo-pagina.png).
 * CSS, ícones e funções de render foram copiados de lá sem mudança de visual;
 * as únicas diferenças são:
 *  - todo seletor ganhou o prefixo `.catwa` para não vazar no resto do site;
 *  - texto vindo da API passa por `esc()` antes de virar HTML;
 *  - página com menos de 4 produtos completa a grade com cards de apoio
 *    (mesma moldura do card) em vez de deixar buraco;
 *  - bolinha de litragem só aparece quando o produto tem litragem;
 *  - colunas/linhas da grade em minmax(0,1fr) e h1 com color:inherit, para
 *    nome longo não alargar uma coluna e o CSS base do site não pintar o h1;
 *  - nome longo reduz a fonte até caber na barra (ajustarNomes).
 */

export interface Recurso { i: string; t: string }

export interface ProdutoCatalogo {
  codigo: string;
  nome: string;
  litros: string;
  icone: string;
  foto: string;
  desc: string;
  recursos: Recurso[];
  /** [20, 50, 100+]; null = produto sem preço na API (fica "consulte"). */
  precos: (number | null)[];
}

export interface ConfigCatalogo {
  tag: string;
  titulo: string;
  slogan: string;
  faixas: string[];
  beneficios: { i: string; t: string; s: string }[];
  contatos: { n: string; i: string }[];
}

export const LOGO = "/catalogo-whatsapp/logo-giftweb.png";

export const CONFIG_PADRAO: ConfigCatalogo = {
  tag: "CATÁLOGO DE", titulo: "MOCHILAS",
  slogan: "Sua marca em todos os destinos",
  faixas: ["20 UN.", "50 UN.", "100+ UN."],
  beneficios: [
    { i: "caixa", t: "PEDIDO MÍNIMO 20 UN.", s: "Consulte condições" },
    { i: "caminhao", t: "ENTREGAMOS EM TODO O BRASIL", s: "Consulte o frete" },
    { i: "cartao", t: "PARCELAMENTO EM ATÉ 6X", s: "(consulte)" },
    { i: "presente", t: "PERSONALIZAÇÃO COM SUA MARCA", s: "Fortaleça seu negócio" },
  ],
  contatos: [
    { n: "(48) 99665-2844", i: "whatsapp" },
    { n: "(11) 97016-9697", i: "whatsapp" },
    { n: "giftwebbrindes.com.br", i: "globo" },
  ],
};

export const CSS = `
  .catwa{
    --navy:#0a2342; --navy2:#0f3a5f; --green:#1db35f; --green2:#148f4a;
    --ink:#0a2342; --muted:#3d5675; --line:#cfd8e3;
    --font:"Montserrat","Helvetica Neue",Arial,sans-serif;
    background:#ffffff;font-family:var(--font);line-height:normal
  }
  .catwa *{box-sizing:border-box;margin:0;padding:0}
  .catwa .page{width:1080px;height:1350px;background:#fff;position:relative;overflow:hidden;margin:0 auto 24px;display:flex;flex-direction:column}
  .catwa [contenteditable]:hover{outline:2px dashed rgba(29,179,95,.7);outline-offset:2px}
  .catwa [contenteditable]:focus{outline:2px solid var(--green);outline-offset:2px}
  .catwa svg.i{width:1em;height:1em;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none;display:inline}

  .catwa .head{height:200px;background:linear-gradient(110deg,var(--navy) 55%,#0d4a45 100%);color:#fff;display:flex;align-items:center;padding:0 44px;gap:34px;position:relative}
  .catwa .head:after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:26px;background:#fff;border-radius:50% 50% 0 0/100% 100% 0 0}
  .catwa .head .logo{height:136px;width:auto;max-width:none;flex:none;margin-top:-14px}
  .catwa .head .tit{flex:1;text-align:center}
  .catwa .head .tag{display:inline-block;background:var(--green);border-radius:8px;padding:5px 22px;font-weight:700;letter-spacing:4px;font-size:17px}
  .catwa .head h1{font-size:68px;font-weight:900;line-height:1;margin-top:8px;letter-spacing:-1px;color:inherit}
  .catwa .head .slogan{width:190px;font-style:italic;font-size:27px;line-height:1.1;color:#7ff0b0;text-align:center;font-family:"Brush Script MT","Segoe Script",cursive}

  .catwa .grid{flex:1;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);grid-template-rows:minmax(0,1fr) minmax(0,1fr);gap:20px 22px;padding:6px 28px 16px;min-height:0}
  .catwa .card{background:#fff;border-radius:22px;padding:14px 14px 12px;display:flex;flex-direction:column;min-height:0;border:2px solid var(--line)}
  .catwa .ct{display:flex;align-items:center;background:var(--navy);border-radius:30px;height:46px;color:#fff;margin-left:6px}
  .catwa .ct .ic{width:54px;height:54px;border-radius:50%;background:var(--navy);display:flex;align-items:center;justify-content:center;font-size:28px;margin-left:-12px;border:3px solid #fff;flex:none}
  .catwa .ct .nm{font-size:22px;font-weight:400;padding-left:14px;white-space:nowrap;min-width:0;overflow:hidden;text-overflow:ellipsis;margin-right:14px}
  .catwa .cb{display:flex;gap:12px;margin-top:10px;flex:1;min-height:0}
  .catwa .ph{width:218px;flex:none;position:relative;display:flex;align-items:center;justify-content:center;cursor:pointer;background:#fff}
  .catwa .ph img{width:218px;height:218px;max-width:none;object-fit:contain}
  .catwa .ph .lt{position:absolute;left:0;bottom:6px;width:54px;height:54px;border-radius:50%;background:var(--navy);border:3px solid #fff;color:#fff;font-weight:900;font-size:19px;display:flex;align-items:center;justify-content:center;}
  .catwa .inf{flex:1;min-width:0;display:flex;flex-direction:column}
  .catwa .cod{align-self:center;border:1.5px solid var(--navy);border-radius:14px;padding:1px 12px;font-size:11px;font-weight:700;color:var(--navy)}
  .catwa .cod b{font-weight:900}
  .catwa .ds{font-size:13px;line-height:1.32;color:var(--ink);margin-top:8px;flex:1;min-height:0;overflow:hidden}
  .catwa .rs{margin-top:6px;display:flex;flex-direction:column;gap:5px}
  .catwa .r{display:flex;align-items:center;gap:10px;font-size:13.5px;color:var(--ink)}
  .catwa .r .i{font-size:20px;color:var(--navy)}
  .catwa .pr{display:flex;gap:10px;margin-top:8px}
  .catwa .p{flex:1;border-radius:10px;overflow:hidden;background:#fff;text-align:center;border:1.5px solid var(--line)}
  .catwa .p .f{background:linear-gradient(90deg,var(--green2),var(--green));color:#fff;font-weight:800;font-size:14px;padding:3px 0}
  .catwa .p .v{font-size:25px;font-weight:900;color:var(--navy);padding-top:4px;white-space:nowrap}
  .catwa .p .v small{font-size:14px;font-weight:800;margin-right:3px}
  .catwa .p .v i{font-style:normal;font-size:16px}
  .catwa .p .c{font-size:11px;font-weight:600;color:var(--muted);padding-bottom:4px}

  .catwa .foot{background:var(--navy);color:#fff;position:relative}
  .catwa .foot:before{content:"";position:absolute;left:0;right:0;top:-14px;height:28px;background:var(--navy);border-radius:50% 50% 0 0/100% 100% 0 0}
  .catwa .ben{display:flex;align-items:stretch;padding:0 22px;height:80px;position:relative;z-index:1}
  .catwa .b{flex:1;display:flex;align-items:center;gap:12px;padding:0 14px;border-left:1px solid rgba(255,255,255,.25)}
  .catwa .b:first-child{border-left:0}
  .catwa .b .i{font-size:32px;color:var(--green)}
  .catwa .b .t{font-weight:400;font-size:12.5px;line-height:1.2}
  .catwa .b .s{font-weight:400;font-size:10.5px;opacity:.85;margin-top:2px}
  .catwa .con{height:58px;margin:0 40px;border-top:1px solid rgba(255,255,255,.25);display:flex;align-items:center;justify-content:center;gap:70px;position:relative;z-index:1}
  .catwa .cn{display:flex;align-items:center;gap:10px}
  .catwa .cn .i{font-size:26px;color:var(--green)}
  .catwa .cn .n{font-size:17px;font-weight:400;white-space:nowrap}

  /* card de apoio: ocupa a vaga de produto que faltou na última página */
  .catwa .card.apoio{background:linear-gradient(150deg,var(--navy) 55%,#0d4a45 100%);border-color:var(--navy);color:#fff;align-items:center;justify-content:center;text-align:center;gap:14px;padding:24px 34px}
  .catwa .apoio .ai{width:96px;height:96px;border-radius:50%;background:var(--green);display:flex;align-items:center;justify-content:center;font-size:52px;border:4px solid #fff}
  .catwa .apoio .at{font-size:28px;font-weight:900;line-height:1.1}
  .catwa .apoio .as{font-size:16px;line-height:1.35;opacity:.9}
  .catwa .apoio .ad{font-size:20px;font-weight:800;color:#7ff0b0;white-space:nowrap}
`;

/* ===== ÍCONES (trocar a chave em recursos[].i) ===== */
export const P: Record<string, string> = {
  notebook: '<rect x="4" y="5" width="16" height="11" rx="1.5"/><path d="M2 19h20"/>',
  agua: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  usb: '<path d="M12 3v15"/><circle cx="12" cy="20" r="2"/><path d="M12 12l4-3v-2M12 9L8 7"/><rect x="14.5" y="4" width="3.2" height="3.2"/><circle cx="7" cy="6.5" r="1.3"/>',
  alcas: '<path d="M8 4c-2 4-2 12 0 16M16 4c2 4 2 12 0 16"/><path d="M8 4h8M8 20h8"/>',
  camadas: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  grade: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
  mala: '<rect x="6" y="7" width="12" height="14" rx="2"/><path d="M9 7V4h6v3M10 11v6M14 11v6"/>',
  mochila: '<path d="M8 6a4 4 0 0 1 8 0"/><rect x="5" y="6" width="14" height="15" rx="4"/><path d="M9 14h6"/>',
  dobra: '<path d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v8"/>',
  escudo: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  caminhao: '<path d="M2 6h11v10H2zM13 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  caixa: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>',
  cartao: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
  presente: '<rect x="3" y="9" width="18" height="12" rx="1"/><path d="M3 13h18M12 9v12"/><path d="M12 9C9 9 8 4 11 4c2 0 1 5 1 5zM12 9c3 0 4-5 1-5-2 0-1 5-1 5z"/>',
  zap: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
  whatsapp: '<path d="M3 21l1.6-4.5A8.5 8.5 0 1 1 8 19.5z"/><path d="M9 9c0 3 3 6 6 6l1.5-1.5-2-1-1 1c-1-.5-2-1.5-2.5-2.5l1-1-1-2z"/>',
  globo: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/>',
  // novos, no mesmo estilo (24x24, traço 1.8)
  termico: '<path d="M12 2v20M4 7l16 10M20 7L4 17"/><path d="M9 4l3 2 3-2M9 20l3-2 3 2"/>',
  cadeado: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3M12 15v2"/>',
  regua: '<path d="M3 16L16 3l5 5L8 21z"/><path d="M7 12l2 2M10 9l2 2M13 6l2 2"/>',
  bolso: '<path d="M5 5h14v9a7 7 0 0 1-14 0z"/><path d="M5 9h14"/>',
  reflexivo: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>',
  ziper: '<path d="M12 2v20"/><path d="M9 5h3M12 8h3M9 11h3M12 14h3"/><rect x="9" y="16" width="6" height="5" rx="1.5"/>',
  garrafa: '<path d="M10 2h4v3l2 3v12a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V8l2-3z"/><path d="M8 12h8"/>',
};
export const ico = (k: string) => `<svg class="i" viewBox="0 0 24 24">${P[k] || P.caixa}</svg>`;

/* ===== RENDER ===== */
export const esc = (s: string) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const brl = (v: number | null) => {
  if (v === null || !Number.isFinite(v)) return `<small>R$</small><span contenteditable>consulte</span>`;
  const [a, b] = v.toFixed(2).split(".");
  return `<small>R$</small><span contenteditable>${Number(a).toLocaleString("pt-BR")},${b}</span>`;
};
/** Corta na última palavra inteira, sem pontuação antes das reticências. */
const cortar = (s: string, n: number) => s.slice(0, n).replace(/\s+\S*$/, "").replace(/[\s,;:.\-–]+$/, "") + "…";
export const trunc = (s: string, n = 240) => (s.length > n ? cortar(s, n) : s);
const E = (t: string, tag = "span", cls = "") => `<${tag} ${cls ? `class="${cls}"` : ""} contenteditable>${esc(t)}</${tag}>`;

const card = (p: ProdutoCatalogo, cfg: ConfigCatalogo) => `
 <div class="card">
  <div class="ct"><div class="ic">${ico(p.icone)}</div>${E(p.nome, "span", "nm")}</div>
  <div class="cb">
    <div class="ph" title="Clique para trocar a foto"><img src="${esc(p.foto)}" alt="">${p.litros ? E(p.litros, "span", "lt") : ""}</div>
    <div class="inf">
      <div class="cod">CÓD. <b contenteditable>${esc(p.codigo)}</b></div>
      <div class="ds" contenteditable data-full="${esc(trunc(p.desc))}">${esc(trunc(p.desc))}</div>
      <div class="rs">${p.recursos.slice(0, 4).map((r) => `<div class="r">${ico(r.i)}${E(r.t)}</div>`).join("")}</div>
    </div>
  </div>
  <div class="pr">${p.precos.map((v, i) => `<div class="p"><div class="f" contenteditable>${esc(cfg.faixas[i] ?? "")}</div><div class="v">${brl(v)}</div><div class="c">CADA</div></div>`).join("")}</div>
 </div>`;

/** Cards que completam a última página (nunca sobra buraco na grade 2x2). */
const APOIO = [
  { i: "presente", t: "SUA MARCA AQUI", s: "Personalizamos cada peça com a identidade da sua empresa.", d: "giftwebbrindes.com.br" },
  { i: "whatsapp", t: "SOLICITE SEU ORÇAMENTO", s: "Atendimento rápido pelo WhatsApp.", d: "(48) 99665-2844" },
  { i: "globo", t: "MAIS MODELOS NO SITE", s: "Milhares de brindes com preço por quantidade.", d: "giftwebbrindes.com.br" },
];
const apoio = (k: number) => {
  const a = APOIO[k % APOIO.length];
  return `
 <div class="card apoio">
  <div class="ai">${ico(a.i)}</div>
  ${E(a.t, "div", "at")}${E(a.s, "div", "as")}${E(a.d, "div", "ad")}
 </div>`;
};

export const paginar = <T,>(lista: T[], n = 4): T[][] => {
  const pages: T[][] = [];
  for (let i = 0; i < lista.length; i += n) pages.push(lista.slice(i, i + n));
  return pages;
};

export function renderPaginas(produtos: ProdutoCatalogo[], cfg: ConfigCatalogo): string {
  return paginar(produtos).map((g, n) => `
 <section class="page" id="catwa-pg${n + 1}">
  <div class="head">
    <img class="logo" src="${LOGO}" alt="Gift Web Brindes">
    <div class="tit">${E(cfg.tag, "div", "tag")}${E(cfg.titulo, "h1")}</div>
    ${E(cfg.slogan, "div", "slogan")}
  </div>
  <div class="grid">${g.map((p) => card(p, cfg)).join("")}${Array.from({ length: 4 - g.length }, (_, k) => apoio(k)).join("")}</div>
  <div class="foot">
    <div class="ben">${cfg.beneficios.map((b) => `<div class="b">${ico(b.i)}<div>${E(b.t, "div", "t")}${E(b.s, "div", "s")}</div></div>`).join("")}</div>
    <div class="con">${cfg.contatos.map((c) => `<div class="cn">${ico(c.i)}${E(c.n, "div", "n")}</div>`).join("")}</div>
  </div>
 </section>`).join("");
}

/* ===== FOTO 600x600 (fundo branco, contain) ===== */
export function to600(src: string): Promise<string> {
  return new Promise((res) => {
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = c.height = 600;
        const x = c.getContext("2d")!;
        x.fillStyle = "#fff";
        x.fillRect(0, 0, 600, 600);
        const s = Math.min(600 / im.width, 600 / im.height);
        x.drawImage(im, (600 - im.width * s) / 2, (600 - im.height * s) / 2, im.width * s, im.height * s);
        res(c.toDataURL("image/jpeg", 0.92));
      } catch {
        res(src);
      }
    };
    im.onerror = () => res(src);
    im.src = src;
  });
}

/**
 * Renderiza a página em canvas 1080x1350.
 *
 * O preflight do Tailwind põe `img{display:block}`, e o html2canvas mede a
 * linha de base do texto com um <img> que ele pendura no body do documento
 * real (não no clone): com display:block a medida erra e todo texto sai
 * deslocado para baixo no PNG. Durante a captura o <img> volta a inline.
 */
export async function paginaParaCanvas(el: HTMLElement): Promise<HTMLCanvasElement> {
  const { default: html2canvas } = await import("html2canvas");
  const st = document.createElement("style");
  st.textContent = "body > div > img{display:inline !important}";
  document.head.appendChild(st);
  try {
    return await html2canvas(el, { scale: 1, useCORS: true, backgroundColor: "#fff", width: 1080, height: 1350 });
  } finally {
    st.remove();
  }
}

/**
 * Descrição ocupa todo o espaço livre entre o código e os recursos: mostra o
 * texto inteiro se couber, senão corta na última palavra que cabe e termina
 * com "…" (busca binária medindo a altura, como o fitDesc do template).
 */
export function fitDesc(el: HTMLElement) {
  const full = el.dataset.full ?? "";
  const cabe = () => el.scrollHeight <= el.clientHeight + 1;
  el.textContent = full;
  if (cabe()) return;
  let lo = 0;
  let hi = full.length;
  while (lo < hi - 1) {
    const m = (lo + hi) >> 1;
    el.textContent = cortar(full, m);
    if (cabe()) lo = m;
    else hi = m;
  }
  el.textContent = cortar(full, lo);
}

export const ajustarDescricoes = (root: ParentNode) => root.querySelectorAll<HTMLElement>(".ds[data-full]").forEach(fitDesc);

/** Nome longo: reduz a fonte até caber na faixa (mantém uma linha). */
export function ajustarNomes(root: ParentNode) {
  root.querySelectorAll<HTMLElement>(".ct .nm").forEach((nm) => {
    const ct = nm.parentElement!;
    const limite = () => ct.getBoundingClientRect().right - 14;
    nm.style.fontSize = "";
    let px = 22;
    while (nm.getBoundingClientRect().left + nm.scrollWidth > limite() && px > 13) nm.style.fontSize = `${--px}px`;
  });
}
