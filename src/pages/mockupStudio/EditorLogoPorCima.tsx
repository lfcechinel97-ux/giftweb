import { useEffect, useRef, useState } from "react";
import { Canvas, FabricImage } from "fabric";
import { Check, Copy, Loader2, RotateCcw, RotateCw, Trash2 } from "lucide-react";
import type { CaixaPosicao, Tecnica } from "./types";
import { ui } from "./ui";

interface Props {
  /** Cenário gerado pela IA (produtos lisos, sem logo). */
  cenarioUrl: string;
  /** Logo recortada/sem fundo na resolução original, sem girar. */
  logoUrl: string;
  tecnica: Tecnica;
  /** Posição escolhida na Etapa 3 -- só ponto de partida (a IA reenquadra o
   * produto, então raramente cai no lugar exato). */
  box: CaixaPosicao;
  /** Último ajuste feito aqui (uma entrada por logo), pra reabrir igual. */
  inicial?: EstadoEditor[] | null;
  /** Quantas logos já começam na tela (uma por unidade de produto na foto). */
  copiasIniciais?: number;
  onConcluir: (imagemDataUrl: string, estado: EstadoEditor[]) => void;
}

/** Posição de uma logo em % do cenário (centro), largura em % e ângulo. */
export interface EstadoEditor { xPct: number; yPct: number; wPct: number; anguloGraus: number }

const CANVAS_MAX = 620;

/**
 * Modo "colar por cima": a logo NÃO passa pela IA (que estragava logos em
 * baixa qualidade) -- o vendedor posiciona a arte original sobre o cenário
 * gerado e a gente compõe localmente, com um acabamento leve por técnica
 * (laser vira prateado; DTF mantém as cores). Dá pra duplicar a logo, uma
 * por produto quando a foto tem vários.
 */
export default function EditorLogoPorCima({ cenarioUrl, logoUrl, tecnica, box, inicial, copiasIniciais = 1, onConcluir }: Props) {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const logoTratadaRef = useRef<HTMLCanvasElement | null>(null);
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [angulo, setAngulo] = useState(0);
  const [selecionada, setSelecionada] = useState(false);
  const [total, setTotal] = useState(0);

  const logos = () => (fabricRef.current?.getObjects() ?? []) as FabricImage[];
  const ativa = () => fabricRef.current?.getActiveObject() as FabricImage | undefined;

  /** Cria uma logo na tela a partir de um estado em %. */
  const criarLogo = (pos: EstadoEditor) => {
    const canvas = fabricRef.current;
    const tratada = logoTratadaRef.current;
    if (!canvas || !tratada) return;
    const w = canvas.getWidth();
    const h = canvas.getHeight();
    const s = ((pos.wPct / 100) * w) / tratada.width;
    const obj = new FabricImage(tratada, {
      left: (pos.xPct / 100) * w,
      top: (pos.yPct / 100) * h,
      originX: "center",
      originY: "center",
      scaleX: s,
      scaleY: s,
      angle: pos.anguloGraus,
      opacity: tecnica === "laser" ? 0.92 : 0.97,
      cornerColor: "#2563eb",
      cornerStyle: "circle",
      transparentCorners: false,
      borderColor: "#2563eb",
      lockScalingFlip: true,
    });
    // Só cantos (proporção travada) e rotação -- sem recorte aqui.
    obj.setControlsVisibility({ mt: false, mb: false, ml: false, mr: false });
    canvas.add(obj);
    canvas.setActiveObject(obj);
    canvas.requestRenderAll();
    setTotal(canvas.getObjects().length);
  };

  const estadoDe = (obj: FabricImage): EstadoEditor => {
    const canvas = fabricRef.current!;
    return {
      xPct: (obj.left! / canvas.getWidth()) * 100,
      yPct: (obj.top! / canvas.getHeight()) * 100,
      wPct: (obj.getScaledWidth() / canvas.getWidth()) * 100,
      anguloGraus: obj.angle || 0,
    };
  };

  useEffect(() => {
    if (!canvasElRef.current) return;
    let cancelado = false;
    const canvas = new Canvas(canvasElRef.current, { preserveObjectStacking: true });
    fabricRef.current = canvas;
    canvas.on("object:scaling", (e) => {
      const t = e.transform?.target;
      if (t) t.scaleY = t.scaleX;
    });
    canvas.on("object:rotating", (e) => {
      const t = e.transform?.target;
      if (t) setAngulo(Math.round(t.angle));
    });
    const aoSelecionar = () => {
      const obj = canvas.getActiveObject();
      setSelecionada(!!obj);
      if (obj) setAngulo(Math.round(obj.angle || 0));
    };
    canvas.on("selection:created", aoSelecionar);
    canvas.on("selection:updated", aoSelecionar);
    canvas.on("selection:cleared", aoSelecionar);

    (async () => {
      try {
        const [cenarioImg, logoImg] = await Promise.all([carregar(cenarioUrl), carregar(logoUrl)]);
        if (cancelado) return;
        const escala = Math.min(CANVAS_MAX / cenarioImg.naturalWidth, CANVAS_MAX / cenarioImg.naturalHeight, 1);
        const w = Math.round(cenarioImg.naturalWidth * escala);
        const h = Math.round(cenarioImg.naturalHeight * escala);
        canvas.setDimensions({ width: w, height: h });
        canvas.backgroundImage = new FabricImage(cenarioImg, { scaleX: escala, scaleY: escala, selectable: false, evented: false });
        logoTratadaRef.current = tratarLogo(logoImg, tecnica);

        // Ponto de partida: o último ajuste; senão uma logo por unidade de
        // produto, espalhadas na horizontal na altura escolhida na Etapa 3.
        const n = Math.max(1, Math.min(12, copiasIniciais));
        const posicoes: EstadoEditor[] = inicial?.length
          ? inicial
          : n === 1
            ? [{ xPct: box.xPct, yPct: box.yPct, wPct: box.wPct, anguloGraus: box.anguloGraus || 0 }]
            : Array.from({ length: n }, (_, i) => ({
              xPct: ((i + 0.5) / n) * 100,
              yPct: box.yPct,
              wPct: Math.min(box.wPct, 70 / n),
              anguloGraus: box.anguloGraus || 0,
            }));
        posicoes.forEach(criarLogo);
        setPronto(true);
      } catch (e) {
        if (!cancelado) setErro(e instanceof Error ? e.message : "Não foi possível abrir o editor.");
      }
    })();

    return () => {
      cancelado = true;
      canvas.dispose();
      fabricRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cenarioUrl, logoUrl]);

  const definirAngulo = (valor: number) => {
    const canvas = fabricRef.current;
    const obj = ativa();
    if (!canvas || !obj) return;
    let v = valor % 360;
    if (v > 180) v -= 360;
    if (v < -180) v += 360;
    obj.set({ angle: v });
    obj.setCoords();
    canvas.requestRenderAll();
    setAngulo(Math.round(v));
  };

  /** Copia a logo selecionada (mesmo tamanho/ângulo), um pouco ao lado. */
  const duplicar = () => {
    const base = ativa() ?? logos()[logos().length - 1];
    if (!base) return;
    const e = estadoDe(base);
    // Desloca um pouco (sem sair da tela) pra cópia não ficar escondida embaixo.
    const dx = e.xPct + 6 > 95 ? -6 : 6;
    criarLogo({ ...e, xPct: e.xPct + dx, yPct: Math.min(95, e.yPct + 4) });
  };

  const remover = () => {
    const canvas = fabricRef.current;
    const obj = ativa();
    if (!canvas || !obj || logos().length <= 1) return;
    canvas.remove(obj);
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    setTotal(canvas.getObjects().length);
  };

  const concluir = async () => {
    const canvas = fabricRef.current;
    const tratada = logoTratadaRef.current;
    if (!canvas || !tratada) return;
    setSalvando(true);
    try {
      const objetos = logos();
      const estados = objetos.map(estadoDe);
      // Compõe na resolução real do cenário (não na prévia de tela).
      const cenario = await carregar(cenarioUrl);
      const out = document.createElement("canvas");
      out.width = cenario.naturalWidth;
      out.height = cenario.naturalHeight;
      const ctx = out.getContext("2d");
      if (!ctx) throw new Error("Não foi possível montar a imagem.");
      ctx.drawImage(cenario, 0, 0);
      estados.forEach((estado, i) => {
        const lw = (estado.wPct / 100) * out.width;
        const lh = lw * (tratada.height / tratada.width);
        ctx.save();
        ctx.translate((estado.xPct / 100) * out.width, (estado.yPct / 100) * out.height);
        ctx.rotate((estado.anguloGraus * Math.PI) / 180);
        ctx.globalAlpha = objetos[i].opacity ?? 1;
        ctx.drawImage(tratada, -lw / 2, -lh / 2, lw, lh);
        ctx.restore();
      });
      onConcluir(out.toDataURL("image/png"), estados);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível montar a imagem.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <p className="text-sm text-[var(--gw-text-secondary)] text-center mb-3">
        Arraste cada logo pro lugar certo no produto, puxe os cantos pra redimensionar e gire se precisar.
        Clique numa logo pra selecionar; "Duplicar" cria outra igual.
      </p>
      <div className="relative rounded-2xl p-3 bg-gradient-to-br from-[#EAF1FF] via-[#F5F8FC] to-[#F1EDFF] border border-[var(--gw-border)]">
        <div className="bg-white rounded-xl overflow-hidden shadow-[var(--gw-shadow-lg)] relative">
          <canvas ref={canvasElRef} />
          {!pronto && !erro && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/70 min-h-[200px] min-w-[200px]">
              <Loader2 className="w-6 h-6 animate-spin text-[#2563EB]" />
            </div>
          )}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        <div className={`flex items-center gap-1 px-2 py-1.5 rounded-xl border border-[var(--gw-border)] bg-white ${selecionada ? "" : "opacity-40 pointer-events-none"}`}>
          <button type="button" onClick={() => definirAngulo(angulo - 1)} className="p-1.5 rounded-lg hover:bg-[var(--gw-surface-alt)]" title="Girar -1°">
            <RotateCcw className="w-4 h-4" />
          </button>
          <span className="w-12 text-center text-sm font-semibold">{angulo}°</span>
          <button type="button" onClick={() => definirAngulo(angulo + 1)} className="p-1.5 rounded-lg hover:bg-[var(--gw-surface-alt)]" title="Girar +1°">
            <RotateCw className="w-4 h-4" />
          </button>
        </div>
        <button type="button" onClick={duplicar} disabled={!pronto} className={ui.btnSecundario}>
          <Copy className="w-4 h-4" /> Duplicar logo
        </button>
        <button type="button" onClick={remover} disabled={!pronto || !selecionada || total <= 1} className={ui.btnSecundario} title="Remove a logo selecionada">
          <Trash2 className="w-4 h-4" /> Remover
        </button>
        <button type="button" onClick={concluir} disabled={!pronto || salvando} className={ui.btnPrimario}>
          {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Concluir mockup
        </button>
      </div>
      {erro && <div className={`${ui.erro} mt-4`}>{erro}</div>}
    </div>
  );
}

function carregar(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = src;
  return new Promise((resolve, reject) => {
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Não foi possível carregar a imagem."));
  });
}

/** Acabamento local por técnica. Laser: arte vira prateado (mantém só o
 * desenho, pela transparência). DTF: cores originais. */
function tratarLogo(img: HTMLImageElement, tecnica: Tecnica): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);
  if (tecnica !== "laser") return c;
  const dados = ctx.getImageData(0, 0, c.width, c.height);
  const p = dados.data;
  for (let i = 0; i < p.length; i += 4) {
    // Prateado com leve variação pela luminância original (dá relevo).
    const lum = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
    const v = Math.round(200 + (lum / 255) * 35);
    p[i] = v;
    p[i + 1] = v + 2;
    p[i + 2] = Math.min(255, v + 6);
  }
  ctx.putImageData(dados, 0, 0);
  return c;
}
