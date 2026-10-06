import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize, Minus, Plus, ScanSearch } from "lucide-react";
import type { PDFPageProxy, RenderTask } from "pdfjs-dist";

/* Visualizador do PDF gerado com zoom e arraste. Desenha só o pedaço da
   folha que está na tela (o canvas tem o tamanho da caixa), então dá para
   aproximar até ver a borda de 0,15 mm entre a logo e o TOYO. */

/** Retângulo em pontos PDF (origem embaixo à esquerda, y para cima). */
export interface Retangulo {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Alvo {
  rotulo: string;
  ret: Retangulo;
}

/** 100% = tamanho real na tela (CSS: 96 px por polegada, 72 pt por polegada). */
const REAL = 96 / 72;
const ZOOM_MAX = REAL * 80;

interface Vista {
  zoom: number; // px de tela por ponto PDF
  cx: number; // centro da tela, em pontos PDF
  cy: number;
}

const AZUL = "#1464D2";

export default function VisualizadorPdf({ pdf, alvos }: { pdf: Uint8Array; alvos: Alvo[] }) {
  const caixaRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paginaRef = useRef<{ pagina: PDFPageProxy; w: number; h: number } | null>(null);
  const vistaRef = useRef<Vista | null>(null);
  const tarefaRef = useRef<RenderTask | null>(null);
  const quadroRef = useRef(0);
  const [zoomTexto, setZoomTexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const tamanho = () => {
    const el = caixaRef.current;
    return { W: el?.clientWidth || 600, H: el?.clientHeight || 400 };
  };

  const zoomAjustado = useCallback(() => {
    const p = paginaRef.current;
    if (!p) return 1;
    const { W, H } = tamanho();
    return Math.min((W - 24) / p.w, (H - 24) / p.h);
  }, []);

  const desenhar = useCallback(() => {
    cancelAnimationFrame(quadroRef.current);
    quadroRef.current = requestAnimationFrame(async () => {
      const p = paginaRef.current, v = vistaRef.current, canvas = canvasRef.current;
      if (!p || !v || !canvas) return;
      const { W, H } = tamanho();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cw = Math.round(W * dpr), ch = Math.round(H * dpr);
      const k = v.zoom * dpr;
      // desenha fora da tela e copia no fim: sem piscar durante o zoom
      const off = document.createElement("canvas");
      off.width = cw;
      off.height = ch;
      const ctx = off.getContext("2d")!;
      const tx = cw / 2 - v.cx * k;
      const ty = ch / 2 - (p.h - v.cy) * k;
      ctx.fillStyle = "#E2E8F0";
      ctx.fillRect(0, 0, cw, ch);
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(tx, ty, p.w * k, p.h * k);
      tarefaRef.current?.cancel();
      const tarefa = p.pagina.render({
        canvasContext: ctx,
        viewport: p.pagina.getViewport({ scale: k }),
        transform: [1, 0, 0, 1, tx, ty],
        background: "rgba(0,0,0,0)",
      });
      tarefaRef.current = tarefa;
      try {
        await tarefa.promise;
      } catch {
        return; // cancelada por um quadro mais novo
      }
      canvas.width = cw;
      canvas.height = ch;
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      canvas.getContext("2d")!.drawImage(off, 0, 0);
      // contorno da folha, para enxergar onde ela acaba
      const c2 = canvas.getContext("2d")!;
      c2.strokeStyle = "#94A3B8";
      c2.lineWidth = 1;
      c2.strokeRect(Math.round(tx) + 0.5, Math.round(ty) + 0.5, Math.round(p.w * k) - 1, Math.round(p.h * k) - 1);
    });
  }, []);

  const aplicar = useCallback((v: Vista) => {
    const min = zoomAjustado() * 0.5;
    const zoom = Math.min(ZOOM_MAX, Math.max(min, v.zoom));
    vistaRef.current = { ...v, zoom };
    setZoomTexto(`${Math.round((zoom / REAL) * 100).toLocaleString("pt-BR")}%`);
    desenhar();
  }, [desenhar, zoomAjustado]);

  const ajustar = useCallback(() => {
    const p = paginaRef.current;
    if (!p) return;
    aplicar({ zoom: zoomAjustado(), cx: p.w / 2, cy: p.h / 2 });
  }, [aplicar, zoomAjustado]);

  const focar = useCallback((r: Retangulo) => {
    const { W, H } = tamanho();
    aplicar({ zoom: Math.min(W / (r.w * 1.25), H / (r.h * 1.25)), cx: r.x + r.w / 2, cy: r.y + r.h / 2 });
  }, [aplicar]);

  /** Zoom mantendo parado o ponto da tela (mx, my). */
  const zoomEm = useCallback((fator: number, mx?: number, my?: number) => {
    const v = vistaRef.current;
    if (!v) return;
    const { W, H } = tamanho();
    const sx = mx ?? W / 2, sy = my ?? H / 2;
    const px = v.cx + (sx - W / 2) / v.zoom;
    const py = v.cy - (sy - H / 2) / v.zoom;
    const zoom = Math.min(ZOOM_MAX, Math.max(zoomAjustado() * 0.5, v.zoom * fator));
    aplicar({ zoom, cx: px - (sx - W / 2) / zoom, cy: py + (sy - H / 2) / zoom });
  }, [aplicar, zoomAjustado]);

  // carrega o PDF; se o tamanho da folha não mudou, mantém o zoom e a posição
  // (dá para mudar a distância do TOYO e ver o efeito no mesmo lugar)
  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        const { default: workerUrl } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        // o pdf.js transfere o buffer para o worker: passa uma cópia
        const doc = await pdfjs.getDocument({ data: pdf.slice() }).promise;
        const pagina = await doc.getPage(1);
        if (cancelado) return;
        const vp = pagina.getViewport({ scale: 1 });
        const antes = paginaRef.current;
        const mesmoTamanho = antes && Math.abs(antes.w - vp.width) < 0.01 && Math.abs(antes.h - vp.height) < 0.01;
        paginaRef.current = { pagina, w: vp.width, h: vp.height };
        setErro(null);
        if (mesmoTamanho && vistaRef.current) aplicar(vistaRef.current);
        else ajustar();
      } catch {
        if (!cancelado) setErro("Não foi possível desenhar a pré-visualização (o PDF para download não é afetado).");
      }
    })();
    return () => { cancelado = true; };
  }, [pdf, aplicar, ajustar]);

  // redesenha quando a caixa muda de tamanho
  useEffect(() => {
    const el = caixaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => vistaRef.current && desenhar());
    ro.observe(el);
    return () => ro.disconnect();
  }, [desenhar]);

  // roda do mouse (precisa de passive: false para não rolar a página)
  useEffect(() => {
    const el = caixaRef.current;
    if (!el) return;
    const roda = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      zoomEm(Math.exp(-delta * 0.0018), e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener("wheel", roda, { passive: false });
    return () => el.removeEventListener("wheel", roda);
  }, [zoomEm]);

  // arrastar (1 dedo / mouse) e pinça (2 dedos)
  const ponteiros = useRef(new Map<number, { x: number; y: number }>());
  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    ponteiros.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const mapa = ponteiros.current;
    const antes = mapa.get(e.pointerId);
    const v = vistaRef.current;
    if (!antes || !v) return;
    if (mapa.size === 1) {
      aplicar({ ...v, cx: v.cx - (e.clientX - antes.x) / v.zoom, cy: v.cy + (e.clientY - antes.y) / v.zoom });
    } else if (mapa.size === 2) {
      const outro = [...mapa.entries()].find(([id]) => id !== e.pointerId)![1];
      const d0 = Math.hypot(antes.x - outro.x, antes.y - outro.y);
      const d1 = Math.hypot(e.clientX - outro.x, e.clientY - outro.y);
      const r = caixaRef.current!.getBoundingClientRect();
      if (d0 > 0) zoomEm(d1 / d0, (e.clientX + outro.x) / 2 - r.left, (e.clientY + outro.y) / 2 - r.top);
    }
    mapa.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const soltar = (e: React.PointerEvent) => ponteiros.current.delete(e.pointerId);

  const botao = "flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50";

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <button type="button" className={botao} onClick={() => zoomEm(1 / 1.6)} aria-label="Afastar"><Minus className="h-4 w-4" /></button>
        <span className="w-16 text-center text-sm font-semibold tabular-nums text-slate-700">{zoomTexto}</span>
        <button type="button" className={botao} onClick={() => zoomEm(1.6)} aria-label="Aproximar"><Plus className="h-4 w-4" /></button>
        <button type="button" className={botao} onClick={ajustar}><Maximize className="h-4 w-4" /> Folha inteira</button>
        {alvos.map((a) => (
          <button key={a.rotulo} type="button" className={botao} style={{ color: AZUL }} onClick={() => focar(a.ret)}>
            <ScanSearch className="h-4 w-4" /> {a.rotulo}
          </button>
        ))}
      </div>
      <div
        ref={caixaRef}
        className="relative h-[60vh] min-h-[320px] cursor-grab touch-none select-none overflow-hidden rounded-xl border border-slate-200 active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={soltar}
        onPointerCancel={soltar}
        onDoubleClick={(e) => {
          const r = caixaRef.current!.getBoundingClientRect();
          zoomEm(2, e.clientX - r.left, e.clientY - r.top);
        }}
      >
        {erro ? <p className="p-4 text-sm text-slate-500">{erro}</p> : <canvas ref={canvasRef} className="block" />}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Roda do mouse, pinça ou duplo clique para aproximar; arraste para mover. 100% ≈ tamanho real na tela.
      </p>
    </div>
  );
}
