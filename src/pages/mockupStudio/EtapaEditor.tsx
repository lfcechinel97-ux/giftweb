import { useEffect, useRef, useState, useCallback } from "react";
import { Canvas, FabricImage } from "fabric";
import {
  ZoomIn, ZoomOut, Maximize, RotateCcw, Eye, EyeOff, Undo2, Redo2,
  AlignCenterHorizontal, AlignCenterVertical, Download, Sparkles,
} from "lucide-react";
import type { LogoTratada, ProdutoMockup } from "./types";

interface Transform { left: number; top: number; scaleX: number; scaleY: number; angle: number; opacity: number }

interface Props {
  produto: ProdutoMockup;
  logoTratada: LogoTratada;
  onVoltar: () => void;
}

const CANVAS_MAX = 640;

export default function EtapaEditor({ produto, logoTratada, onVoltar }: Props) {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const logoObjRef = useRef<FabricImage | null>(null);
  const historyRef = useRef<Transform[]>([]);
  const historyIndexRef = useRef(-1);
  const initialTransformRef = useRef<Transform | null>(null);

  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [transform, setTransform] = useState<Transform | null>(null);
  const [zoom, setZoom] = useState(1);
  const [logoVisivel, setLogoVisivel] = useState(true);
  const [comparando, setComparando] = useState(false);
  const [podeDesfazer, setPodeDesfazer] = useState(false);
  const [podeRefazer, setPodeRefazer] = useState(false);

  const lerTransform = (obj: FabricImage): Transform => ({
    left: obj.left ?? 0,
    top: obj.top ?? 0,
    scaleX: obj.scaleX ?? 1,
    scaleY: obj.scaleY ?? 1,
    angle: obj.angle ?? 0,
    opacity: obj.opacity ?? 1,
  });

  const aplicarTransform = (obj: FabricImage, t: Transform) => {
    obj.set(t);
    obj.setCoords();
  };

  const atualizarBotoesHistorico = () => {
    setPodeDesfazer(historyIndexRef.current > 0);
    setPodeRefazer(historyIndexRef.current < historyRef.current.length - 1);
  };

  const registrarHistorico = useCallback((t: Transform) => {
    const hist = historyRef.current.slice(0, historyIndexRef.current + 1);
    hist.push(t);
    historyRef.current = hist;
    historyIndexRef.current = hist.length - 1;
    atualizarBotoesHistorico();
  }, []);

  useEffect(() => {
    if (!canvasElRef.current) return;
    let cancelado = false;
    const canvas = new Canvas(canvasElRef.current, { preserveObjectStacking: true });
    fabricRef.current = canvas;

    (async () => {
      try {
        const bgImg = await FabricImage.fromURL(produto.fotoUrl, { crossOrigin: "anonymous" });
        if (cancelado) return;
        const escala = Math.min(CANVAS_MAX / bgImg.width!, CANVAS_MAX / bgImg.height!, 1);
        const w = Math.round(bgImg.width! * escala);
        const h = Math.round(bgImg.height! * escala);
        canvas.setDimensions({ width: w, height: h });
        bgImg.set({ scaleX: escala, scaleY: escala, selectable: false, evented: false });
        canvas.backgroundImage = bgImg;

        const logoImg = await FabricImage.fromURL(logoTratada.url, { crossOrigin: "anonymous" });
        if (cancelado) return;
        const escalaLogo = Math.min((w * 0.35) / logoImg.width!, (h * 0.35) / logoImg.height!);
        logoImg.set({
          left: w / 2,
          top: h / 2,
          originX: "center",
          originY: "center",
          scaleX: escalaLogo,
          scaleY: escalaLogo,
          angle: 0,
          cornerColor: "#2563eb",
          cornerStyle: "circle",
          transparentCorners: false,
          borderColor: "#2563eb",
        });
        canvas.add(logoImg);
        canvas.setActiveObject(logoImg);
        logoObjRef.current = logoImg;

        const inicial = lerTransform(logoImg);
        initialTransformRef.current = inicial;
        setTransform(inicial);
        registrarHistorico(inicial);

        // Redimensionar proporcional por padrão (shift libera a proporção).
        canvas.on("object:scaling", (e) => {
          const target = e.transform?.target;
          if (!target || !e.e) return;
          const livre = (e.e as MouseEvent).shiftKey;
          if (!livre) target.scaleY = target.scaleX;
        });

        canvas.on("object:modified", (e) => {
          const target = e.target as FabricImage | undefined;
          if (!target) return;
          const t = lerTransform(target);
          setTransform(t);
          registrarHistorico(t);
        });

        canvas.on("object:moving", (e) => {
          const target = e.target as FabricImage | undefined;
          if (target) setTransform(lerTransform(target));
        });
        canvas.on("object:rotating", (e) => {
          const target = e.target as FabricImage | undefined;
          if (target) setTransform(lerTransform(target));
        });
        canvas.on("object:scaling", (e) => {
          const target = e.target as FabricImage | undefined;
          if (target) setTransform(lerTransform(target));
        });

        canvas.requestRenderAll();
        setPronto(true);
      } catch (e: any) {
        if (!cancelado) setErro(e?.message || "Não foi possível carregar a foto do produto ou a logo.");
      }
    })();

    return () => {
      cancelado = true;
      canvas.dispose();
      fabricRef.current = null;
      logoObjRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [produto.fotoUrl, logoTratada.url]);

  const commit = (t: Transform) => {
    const logo = logoObjRef.current;
    if (!logo) return;
    aplicarTransform(logo, t);
    fabricRef.current?.requestRenderAll();
    setTransform(t);
    registrarHistorico(t);
  };

  const atualizarCampo = (campo: keyof Transform, valor: number) => {
    if (!transform) return;
    commit({ ...transform, [campo]: valor });
  };

  const desfazer = () => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current -= 1;
    const t = historyRef.current[historyIndexRef.current];
    const logo = logoObjRef.current;
    if (logo) { aplicarTransform(logo, t); fabricRef.current?.requestRenderAll(); setTransform(t); }
    atualizarBotoesHistorico();
  };

  const refazer = () => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    const t = historyRef.current[historyIndexRef.current];
    const logo = logoObjRef.current;
    if (logo) { aplicarTransform(logo, t); fabricRef.current?.requestRenderAll(); setTransform(t); }
    atualizarBotoesHistorico();
  };

  const resetarPosicao = () => {
    if (!initialTransformRef.current) return;
    commit(initialTransformRef.current);
  };

  const centralizar = (eixo: "h" | "v") => {
    const canvas = fabricRef.current;
    if (!canvas || !transform) return;
    const w = canvas.getWidth();
    const h = canvas.getHeight();
    commit(eixo === "h" ? { ...transform, left: w / 2 } : { ...transform, top: h / 2 });
  };

  const alternarZoom = (delta: number) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const novo = Math.min(3, Math.max(0.25, zoom + delta));
    canvas.setZoom(novo);
    setZoom(novo);
  };

  const ajustarTela = () => {
    fabricRef.current?.setZoom(1);
    setZoom(1);
  };

  const alternarVisibilidade = () => {
    const logo = logoObjRef.current;
    if (!logo) return;
    const novo = !logoVisivel;
    logo.visible = novo;
    fabricRef.current?.requestRenderAll();
    setLogoVisivel(novo);
  };

  const iniciarComparacao = () => {
    const logo = logoObjRef.current;
    if (!logo) return;
    logo.visible = false;
    fabricRef.current?.requestRenderAll();
    setComparando(true);
  };
  const terminarComparacao = () => {
    const logo = logoObjRef.current;
    if (!logo) return;
    logo.visible = logoVisivel;
    fabricRef.current?.requestRenderAll();
    setComparando(false);
  };

  const exportarPNG = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    const dataUrl = canvas.toDataURL({ format: "png", multiplier: 2 });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `mockup-${produto.codigoAmigavel || "produto"}.png`;
    a.click();
  };

  const baixarLogoTratada = () => {
    const a = document.createElement("a");
    a.href = logoTratada.url;
    a.download = `logo-tratada-${logoTratada.tecnica}.png`;
    a.click();
  };

  return (
    <div className="flex flex-col lg:flex-row gap-4 px-4 py-6 max-w-6xl mx-auto">
      <div className="flex-1 flex flex-col items-center">
        <div className="flex items-center gap-2 mb-3 flex-wrap justify-center">
          <button onClick={() => alternarZoom(-0.1)} className="p-2 border rounded-lg hover:bg-slate-50" title="Diminuir zoom"><ZoomOut className="w-4 h-4" /></button>
          <span className="text-xs text-slate-500 w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => alternarZoom(0.1)} className="p-2 border rounded-lg hover:bg-slate-50" title="Aumentar zoom"><ZoomIn className="w-4 h-4" /></button>
          <button onClick={ajustarTela} className="p-2 border rounded-lg hover:bg-slate-50" title="Ajustar à tela"><Maximize className="w-4 h-4" /></button>
          <div className="w-px h-5 bg-slate-200 mx-1" />
          <button onClick={desfazer} disabled={!podeDesfazer} className="p-2 border rounded-lg hover:bg-slate-50 disabled:opacity-30" title="Desfazer"><Undo2 className="w-4 h-4" /></button>
          <button onClick={refazer} disabled={!podeRefazer} className="p-2 border rounded-lg hover:bg-slate-50 disabled:opacity-30" title="Refazer"><Redo2 className="w-4 h-4" /></button>
          <div className="w-px h-5 bg-slate-200 mx-1" />
          <button onClick={() => centralizar("h")} className="p-2 border rounded-lg hover:bg-slate-50" title="Centralizar horizontalmente"><AlignCenterHorizontal className="w-4 h-4" /></button>
          <button onClick={() => centralizar("v")} className="p-2 border rounded-lg hover:bg-slate-50" title="Centralizar verticalmente"><AlignCenterVertical className="w-4 h-4" /></button>
          <button onClick={resetarPosicao} className="p-2 border rounded-lg hover:bg-slate-50" title="Restaurar posição inicial"><RotateCcw className="w-4 h-4" /></button>
          <button onClick={alternarVisibilidade} className="p-2 border rounded-lg hover:bg-slate-50" title="Mostrar/ocultar logo">
            {logoVisivel ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
          <button
            onMouseDown={iniciarComparacao}
            onMouseUp={terminarComparacao}
            onMouseLeave={() => comparando && terminarComparacao()}
            className="px-3 py-2 border rounded-lg text-xs hover:bg-slate-50"
            title="Segure para ver o produto original"
          >
            Comparar original
          </button>
        </div>

        <div className="border rounded-xl shadow-sm overflow-auto bg-slate-50 p-2" style={{ maxWidth: CANVAS_MAX + 16 }}>
          <canvas ref={canvasElRef} />
        </div>
        {erro && <p className="text-sm text-red-600 mt-3">{erro}</p>}
        {!pronto && !erro && <p className="text-sm text-slate-400 mt-3">Carregando editor...</p>}

        <div className="mt-6 flex gap-3">
          <button type="button" onClick={onVoltar} className="px-5 py-2.5 rounded-lg border text-sm font-medium hover:bg-slate-50">
            Voltar
          </button>
          <button type="button" onClick={baixarLogoTratada} className="px-5 py-2.5 rounded-lg border text-sm font-medium hover:bg-slate-50">
            Baixar logo tratada
          </button>
          <button
            type="button"
            onClick={exportarPNG}
            disabled={!pronto}
            className="px-5 py-2.5 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-40 flex items-center gap-2"
          >
            <Download className="w-4 h-4" /> Exportar mockup (PNG)
          </button>
        </div>
      </div>

      <div className="w-full lg:w-64 shrink-0">
        <p className="text-xs font-medium text-slate-500 mb-2">Propriedades</p>
        {transform && (
          <div className="space-y-3 border rounded-xl p-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] text-slate-500">Posição X</label>
                <input type="number" className="w-full px-2 py-1.5 text-sm border rounded" value={Math.round(transform.left)} onChange={(e) => atualizarCampo("left", Number(e.target.value))} />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500">Posição Y</label>
                <input type="number" className="w-full px-2 py-1.5 text-sm border rounded" value={Math.round(transform.top)} onChange={(e) => atualizarCampo("top", Number(e.target.value))} />
              </div>
            </div>
            <div>
              <label className="block text-[11px] text-slate-500">Rotação (°)</label>
              <input type="range" min={-180} max={180} className="w-full" value={transform.angle} onChange={(e) => atualizarCampo("angle", Number(e.target.value))} />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500">Escala</label>
              <input type="range" min={0.05} max={3} step={0.01} className="w-full" value={transform.scaleX} onChange={(e) => commit({ ...transform, scaleX: Number(e.target.value), scaleY: Number(e.target.value) })} />
            </div>
            <div>
              <label className="block text-[11px] text-slate-500">Opacidade</label>
              <input type="range" min={0} max={1} step={0.01} className="w-full" value={transform.opacity} onChange={(e) => atualizarCampo("opacity", Number(e.target.value))} />
            </div>
            <p className="text-[11px] text-slate-400 pt-1 border-t">
              Medidas em milímetros ficam disponíveis quando o gabarito deste produto for cadastrado.
            </p>
          </div>
        )}

        <div className="mt-4 border rounded-xl p-3 bg-slate-50">
          <p className="text-xs font-medium text-slate-600 flex items-center gap-1.5 mb-1">
            <Sparkles className="w-3.5 h-3.5" /> Refinar mockup com IA
          </p>
          <p className="text-[11px] text-slate-400">Disponível numa próxima etapa do projeto.</p>
        </div>
      </div>
    </div>
  );
}
