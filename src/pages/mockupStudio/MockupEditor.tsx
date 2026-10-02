import { useEffect, useRef, useState, useCallback } from "react";
import { Canvas, FabricImage, FabricText, Shadow, filters, type FabricObject } from "fabric";
import {
  ZoomIn, ZoomOut, Maximize, RotateCcw, Undo2, Redo2, Trash2,
  AlignCenterHorizontal, AlignCenterVertical, Download, Sparkles, Type, ImagePlus, Expand, Printer,
} from "lucide-react";
import type { LogoTratada, ProdutoMockup, Tecnica } from "./types";
import { TECNICAS } from "./types";
import { aplicarCurvatura } from "./wrapWarp";
import { removerFundoBranco, paraCinza, paraPretoEBranco, paraCorUnica } from "./logoOps";
import { refinarComposicaoComIA } from "./iaTratamento";
import { FUNDOS_PRESET, gerarFundo } from "./backdrops";

interface LogoLayerData {
  kind: "logo";
  origSrc: string;
  tecnica: Tecnica;
  removerFundo: boolean;
  modoCor: "full" | "grayscale" | "bw" | "single";
  corUnica: string;
  curvatura: number;
  brilho: number;
}
interface TextLayerData { kind: "text" }
type LayerData = LogoLayerData | TextLayerData;

interface Props {
  produto: ProdutoMockup;
  logoInicial: LogoTratada;
  onTrocarProduto: () => void;
}

const CANVAS_SIZE = 560;

export default function MockupEditor({ produto, logoInicial, onTrocarProduto }: Props) {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const estadosPorVisaoRef = useRef<Record<string, any>>({});
  const historicoRef = useRef<{ visaoId: string; json: any }[]>([]);
  const historicoIndexRef = useRef(-1);
  const aplicandoHistoricoRef = useRef(false);
  const fundoIdRef = useRef(FUNDOS_PRESET[0].id);

  const [visaoId, setVisaoId] = useState(produto.visoes[0]?.id ?? "");
  const [fundoId, setFundoId] = useState(FUNDOS_PRESET[0].id);
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [podeDesfazer, setPodeDesfazer] = useState(false);
  const [podeRefazer, setPodeRefazer] = useState(false);
  const [selecionado, setSelecionado] = useState<FabricObject | null>(null);
  const [tick, setTick] = useState(0); // força re-render do painel quando a seleção muda de propriedade
  const forcarAtualizacao = () => setTick((n) => n + 1);

  const visaoAtual = produto.visoes.find((v) => v.id === visaoId) ?? produto.visoes[0];

  const salvarEstadoVisao = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas || !visaoAtual) return;
    estadosPorVisaoRef.current[visaoAtual.id] = canvas.toObject(["data", "selectable", "lockUniScaling"]);
  }, [visaoAtual]);

  const registrarHistorico = useCallback(() => {
    if (aplicandoHistoricoRef.current) return;
    const canvas = fabricRef.current;
    if (!canvas || !visaoAtual) return;
    const json = canvas.toObject(["data", "selectable"]);
    const hist = historicoRef.current.slice(0, historicoIndexRef.current + 1);
    hist.push({ visaoId: visaoAtual.id, json });
    historicoRef.current = hist.slice(-50);
    historicoIndexRef.current = historicoRef.current.length - 1;
    setPodeDesfazer(historicoIndexRef.current > 0);
    setPodeRefazer(false);
  }, [visaoAtual]);

  const criarLogoLayer = useCallback(async (canvas: Canvas, src: string, data: Partial<LogoLayerData> = {}) => {
    const img = await FabricImage.fromURL(src, { crossOrigin: "anonymous" });
    const w = canvas.getWidth();
    const h = canvas.getHeight();
    const escala = Math.min((w * 0.35) / img.width!, (h * 0.35) / img.height!);
    const layerData: LogoLayerData = {
      kind: "logo",
      origSrc: src,
      tecnica: logoInicial.tecnica,
      removerFundo: false,
      modoCor: "full",
      corUnica: "#1d4ed8",
      curvatura: 0,
      brilho: 0,
      ...data,
    };
    img.set({
      left: w / 2, top: h / 2, originX: "center", originY: "center",
      scaleX: escala, scaleY: escala,
      cornerColor: "#2563eb", cornerStyle: "circle", transparentCorners: false, borderColor: "#2563eb",
      data: layerData,
    });
    canvas.add(img);
    canvas.setActiveObject(img);
    return img;
  }, [logoInicial.tecnica]);

  // Carrega (ou troca) a visão atual.
  useEffect(() => {
    if (!canvasElRef.current || !visaoAtual) return;
    let cancelado = false;

    let canvas = fabricRef.current;
    if (!canvas) {
      canvas = new Canvas(canvasElRef.current, { preserveObjectStacking: true });
      fabricRef.current = canvas;

      canvas.on("object:scaling", (e) => {
        const target = e.transform?.target;
        if (target && e.e && !(e.e as MouseEvent).shiftKey) target.scaleY = target.scaleX;
      });
      canvas.on("selection:created", (e) => setSelecionado(e.selected?.[0] ?? null));
      canvas.on("selection:updated", (e) => setSelecionado(e.selected?.[0] ?? null));
      canvas.on("selection:cleared", () => setSelecionado(null));
      canvas.on("object:moving", forcarAtualizacao);
      canvas.on("object:rotating", forcarAtualizacao);
      canvas.on("object:scaling", forcarAtualizacao);
      canvas.on("object:modified", () => { registrarHistorico(); forcarAtualizacao(); });
    }

    (async () => {
      try {
        if (!canvas) return;
        canvas.setDimensions({ width: CANVAS_SIZE, height: CANVAS_SIZE });
        const fundoImg = await FabricImage.fromURL(gerarFundo(fundoIdRef.current, CANVAS_SIZE, CANVAS_SIZE));
        if (cancelado || !canvas) return;
        canvas.backgroundImage = fundoImg;

        const salvo = estadosPorVisaoRef.current[visaoAtual.id];
        if (salvo) {
          await canvas.loadFromJSON(salvo);
          canvas.backgroundImage = fundoImg; // loadFromJSON pode trazer um fundo velho junto
          canvas.requestRenderAll();
        } else {
          canvas.clear();
          canvas.backgroundImage = fundoImg;
          const fotoImg = await FabricImage.fromURL(visaoAtual.fotoUrl, { crossOrigin: "anonymous" });
          if (cancelado || !canvas) return;
          const escalaFoto = Math.min((CANVAS_SIZE * 0.78) / fotoImg.width!, (CANVAS_SIZE * 0.78) / fotoImg.height!);
          fotoImg.set({
            left: CANVAS_SIZE / 2, top: CANVAS_SIZE / 2, originX: "center", originY: "center",
            scaleX: escalaFoto, scaleY: escalaFoto, selectable: false, evented: false,
            shadow: new Shadow({ color: "rgba(0,0,0,0.28)", blur: 28, offsetX: 0, offsetY: 16 }),
            data: { kind: "produto" },
          });
          canvas.add(fotoImg);
          if (visaoId === (produto.visoes[0]?.id ?? "")) {
            await criarLogoLayer(canvas, logoInicial.url);
          }
          canvas.requestRenderAll();
          registrarHistorico();
        }
        setPronto(true);
      } catch (e: any) {
        if (!cancelado) setErro(e?.message || "Não foi possível carregar esta vista.");
      }
    })();

    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visaoId]);

  useEffect(() => () => { fabricRef.current?.dispose(); fabricRef.current = null; }, []);

  const trocarVisao = (novoId: string) => {
    salvarEstadoVisao();
    setPronto(false);
    setSelecionado(null);
    setVisaoId(novoId);
  };

  const trocarFundo = async (id: string) => {
    fundoIdRef.current = id;
    setFundoId(id);
    const canvas = fabricRef.current;
    if (!canvas || !pronto) return;
    const fundoImg = await FabricImage.fromURL(gerarFundo(id, CANVAS_SIZE, CANVAS_SIZE));
    canvas.backgroundImage = fundoImg;
    canvas.requestRenderAll();
  };

  const aplicarHistorico = async (idx: number) => {
    const canvas = fabricRef.current;
    const item = historicoRef.current[idx];
    if (!canvas || !item) return;
    aplicandoHistoricoRef.current = true;
    if (item.visaoId !== visaoId) {
      estadosPorVisaoRef.current[item.visaoId] = item.json;
      setVisaoId(item.visaoId);
    } else {
      await canvas.loadFromJSON(item.json);
      canvas.requestRenderAll();
    }
    aplicandoHistoricoRef.current = false;
  };

  const desfazer = () => {
    if (historicoIndexRef.current <= 0) return;
    historicoIndexRef.current -= 1;
    aplicarHistorico(historicoIndexRef.current);
    setPodeDesfazer(historicoIndexRef.current > 0);
    setPodeRefazer(true);
  };
  const refazer = () => {
    if (historicoIndexRef.current >= historicoRef.current.length - 1) return;
    historicoIndexRef.current += 1;
    aplicarHistorico(historicoIndexRef.current);
    setPodeRefazer(historicoIndexRef.current < historicoRef.current.length - 1);
    setPodeDesfazer(true);
  };

  const adicionarTexto = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const texto = new FabricText("Sample", {
      left: canvas.getWidth() / 2, top: canvas.getHeight() / 2,
      originX: "center", originY: "center",
      fontFamily: "Arial", fontSize: 48, fill: "#111827",
      cornerColor: "#2563eb", cornerStyle: "circle", transparentCorners: false, borderColor: "#2563eb",
      data: { kind: "text" } as TextLayerData,
    });
    canvas.add(texto);
    canvas.setActiveObject(texto);
    canvas.requestRenderAll();
    registrarHistorico();
  };

  const uploadInputRef = useRef<HTMLInputElement>(null);
  const adicionarLogoDeArquivo = async (file: File) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const url = URL.createObjectURL(file);
    await criarLogoLayer(canvas, url);
    canvas.requestRenderAll();
    registrarHistorico();
  };

  const excluirSelecionado = () => {
    const canvas = fabricRef.current;
    if (!canvas || !selecionado) return;
    canvas.remove(selecionado);
    canvas.requestRenderAll();
    setSelecionado(null);
    registrarHistorico();
  };

  const centralizar = (eixo: "h" | "v") => {
    const canvas = fabricRef.current;
    if (!canvas || !selecionado) return;
    if (eixo === "h") selecionado.set({ left: canvas.getWidth() / 2 });
    else selecionado.set({ top: canvas.getHeight() / 2 });
    selecionado.setCoords();
    canvas.requestRenderAll();
    registrarHistorico();
    forcarAtualizacao();
  };

  const alternarZoom = (delta: number) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const novo = Math.min(3, Math.max(0.25, zoom + delta));
    canvas.setZoom(novo);
    setZoom(novo);
  };
  const ajustarTela = () => { fabricRef.current?.setZoom(1); setZoom(1); };

  const reprocessarLogo = async (obj: FabricImage, patch: Partial<LogoLayerData>) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const data = { ...(obj.get("data") as LogoLayerData), ...patch };
    let src = data.origSrc;
    if (data.removerFundo) src = await removerFundoBranco(src);
    if (data.modoCor === "grayscale") src = await paraCinza(src);
    else if (data.modoCor === "bw") src = await paraPretoEBranco(src);
    else if (data.modoCor === "single") src = await paraCorUnica(src, data.corUnica);
    if (data.curvatura > 0) src = await aplicarCurvatura(src, data.curvatura);

    const transformAnterior = { left: obj.left, top: obj.top, scaleX: obj.scaleX, scaleY: obj.scaleY, angle: obj.angle, opacity: obj.opacity };
    await obj.setSrc(src, { crossOrigin: "anonymous" });
    obj.set({ ...transformAnterior, data });
    obj.filters = data.brilho ? [new filters.Brightness({ brightness: data.brilho })] : [];
    obj.applyFilters();
    obj.setCoords();
    canvas.requestRenderAll();
    forcarAtualizacao();
  };

  // Brilho usa o filtro nativo do Fabric (não mexe na imagem base), então é
  // leve o bastante pra rodar em tempo real enquanto o vendedor arrasta o
  // slider -- diferente da remoção de fundo/cor/curvatura, que regeneram a
  // imagem inteira e seriam lentas demais pra isso.
  const ajustarBrilho = (obj: FabricImage, valor: number) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const data = { ...(obj.get("data") as LogoLayerData), brilho: valor };
    obj.set({ data });
    obj.filters = valor ? [new filters.Brightness({ brightness: valor })] : [];
    obj.applyFilters();
    canvas.requestRenderAll();
    forcarAtualizacao();
  };

  const [iaBusy, setIaBusy] = useState(false);
  const [iaErro, setIaErro] = useState<string | null>(null);

  // Manda pra IA o produto + a logo juntos, exatamente como estão
  // posicionados no canvas -- não só a logo isolada, pra ela poder ajustar
  // luz/perspectiva considerando a superfície real. O resultado vira o novo
  // fundo (a logo já está "assada" nele), e dá pra desfazer pelo histórico.
  const refinarLogoSelecionadoComIA = async (obj: FabricImage) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const data = obj.get("data") as LogoLayerData;
    setIaBusy(true);
    setIaErro(null);
    try {
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      const composicao = canvas.toDataURL({ format: "png", multiplier: 1 });
      const resultado = await refinarComposicaoComIA(composicao, data.tecnica);
      const novoFundo = await FabricImage.fromURL(resultado.url, { crossOrigin: "anonymous" });
      novoFundo.set({ scaleX: canvas.getWidth() / novoFundo.width!, scaleY: canvas.getHeight() / novoFundo.height! });
      canvas.backgroundImage = novoFundo;
      canvas.remove(obj);
      const produtoObj = canvas.getObjects().find((o) => (o.get("data") as any)?.kind === "produto");
      if (produtoObj) canvas.remove(produtoObj);
      canvas.requestRenderAll();
      setSelecionado(null);
      registrarHistorico();
    } catch (e: any) {
      setIaErro(e?.message || "Não foi possível refinar com IA agora.");
    } finally {
      setIaBusy(false);
    }
  };

  const exportarPNG = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    const dataUrl = canvas.toDataURL({ format: "png", multiplier: 2 });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `mockup-${produto.codigoAmigavel || "produto"}-${visaoAtual?.nome || ""}.png`;
    a.click();
  };

  const imprimir = () => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    const dataUrl = canvas.toDataURL({ format: "png", multiplier: 2 });
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<img src="${dataUrl}" style="max-width:100%" onload="window.print()">`);
    w.document.close();
  };

  const tela = () => containerRef.current?.requestFullscreen?.();

  const data = selecionado?.get("data") as LayerData | undefined;
  const isLogo = data?.kind === "logo";
  const isText = data?.kind === "text";

  return (
    <div className="flex h-[calc(100vh-57px)]">
      {/* Trilho de ferramentas */}
      <div className="w-20 border-r flex flex-col items-center py-4 gap-1 shrink-0">
        <button onClick={adicionarTexto} className="w-16 flex flex-col items-center gap-1 py-2.5 rounded-lg hover:bg-slate-100 text-slate-600">
          <Type className="w-5 h-5" />
          <span className="text-[10px]">Add Text</span>
        </button>
        <button onClick={() => uploadInputRef.current?.click()} className="w-16 flex flex-col items-center gap-1 py-2.5 rounded-lg hover:bg-slate-100 text-slate-600">
          <ImagePlus className="w-5 h-5" />
          <span className="text-[10px]">Upload Logo</span>
        </button>
        <input ref={uploadInputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) adicionarLogoDeArquivo(f); e.target.value = ""; }} />
        <div className="mt-auto">
          <button onClick={onTrocarProduto} className="text-[11px] text-blue-600 hover:underline px-1 text-center">
            Trocar produto
          </button>
        </div>
      </div>

      {/* Painel de propriedades (abre quando algo está selecionado) */}
      {selecionado && (
        <div className="w-64 border-r p-4 overflow-y-auto shrink-0">
          {isText && (
            <TextProperties obj={selecionado as FabricText} onChange={() => { fabricRef.current?.requestRenderAll(); forcarAtualizacao(); }} onCommit={registrarHistorico} />
          )}
          {isLogo && (
            <LogoProperties
              data={data as LogoLayerData}
              onChange={(patch) => reprocessarLogo(selecionado as FabricImage, patch)}
              onCommit={registrarHistorico}
              onBrilhoChange={(v) => ajustarBrilho(selecionado as FabricImage, v)}
              onRefinarIA={() => refinarLogoSelecionadoComIA(selecionado as FabricImage)}
              iaBusy={iaBusy}
              iaErro={iaErro}
            />
          )}
          <div className="mt-4 pt-4 border-t space-y-2">
            <p className="text-[11px] text-slate-500">Rotação</p>
            <input type="range" min={-180} max={180} value={selecionado.angle ?? 0}
              onChange={(e) => { selecionado.set({ angle: Number(e.target.value) }); selecionado.setCoords(); fabricRef.current?.requestRenderAll(); forcarAtualizacao(); }}
              onMouseUp={registrarHistorico}
              className="w-full" />
            <div className="flex gap-1.5">
              <button onClick={() => centralizar("h")} className="flex-1 p-1.5 border rounded hover:bg-slate-50" title="Centralizar horizontal"><AlignCenterHorizontal className="w-3.5 h-3.5 mx-auto" /></button>
              <button onClick={() => centralizar("v")} className="flex-1 p-1.5 border rounded hover:bg-slate-50" title="Centralizar vertical"><AlignCenterVertical className="w-3.5 h-3.5 mx-auto" /></button>
              <button onClick={excluirSelecionado} className="flex-1 p-1.5 border rounded hover:bg-red-50 text-red-600" title="Excluir"><Trash2 className="w-3.5 h-3.5 mx-auto" /></button>
            </div>
          </div>
        </div>
      )}

      {/* Canvas */}
      <div ref={containerRef} className="flex-1 flex flex-col items-center bg-slate-50 overflow-auto py-6 relative">
        <div className="flex items-center gap-1.5 mb-3 flex-wrap justify-center bg-white border rounded-lg px-2 py-1.5 shadow-sm">
          <button onClick={() => alternarZoom(-0.1)} className="p-1.5 rounded hover:bg-slate-100" title="Diminuir zoom"><ZoomOut className="w-4 h-4" /></button>
          <span className="text-xs text-slate-500 w-9 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => alternarZoom(0.1)} className="p-1.5 rounded hover:bg-slate-100" title="Aumentar zoom"><ZoomIn className="w-4 h-4" /></button>
          <button onClick={ajustarTela} className="p-1.5 rounded hover:bg-slate-100" title="Ajustar à tela"><Maximize className="w-4 h-4" /></button>
          <div className="w-px h-5 bg-slate-200 mx-1" />
          <button onClick={desfazer} disabled={!podeDesfazer} className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30" title="Desfazer"><Undo2 className="w-4 h-4" /></button>
          <button onClick={refazer} disabled={!podeRefazer} className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30" title="Refazer"><Redo2 className="w-4 h-4" /></button>
          <div className="w-px h-5 bg-slate-200 mx-1" />
          <button onClick={tela} className="p-1.5 rounded hover:bg-slate-100" title="Tela cheia"><Expand className="w-4 h-4" /></button>
          <button onClick={imprimir} className="p-1.5 rounded hover:bg-slate-100" title="Imprimir"><Printer className="w-4 h-4" /></button>
          <button onClick={exportarPNG} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-green-600 text-white text-xs hover:bg-green-700" title="Exportar PNG">
            <Download className="w-3.5 h-3.5" /> Exportar
          </button>
        </div>

        <div
          className="rounded-xl p-6"
          style={{ background: "radial-gradient(ellipse at center, rgba(0,0,0,0.08) 0%, rgba(0,0,0,0) 70%)" }}
        >
          <div className="bg-white rounded-lg shadow-[0_18px_40px_-12px_rgba(0,0,0,0.25)]">
            <canvas ref={canvasElRef} />
          </div>
        </div>
        {erro && <p className="text-sm text-red-600 mt-3">{erro}</p>}
        {!pronto && !erro && <p className="text-sm text-slate-400 mt-3">Carregando...</p>}

        <div className="flex gap-2 mt-4">
          {FUNDOS_PRESET.map((f) => (
            <button
              key={f.id}
              onClick={() => trocarFundo(f.id)}
              title={f.nome}
              className={`w-8 h-8 rounded-full border-2 ${fundoId === f.id ? "border-blue-500" : "border-white"} shadow`}
              style={{ background: `linear-gradient(135deg, ${f.cores[0]}, ${f.cores[2]})` }}
            />
          ))}
        </div>

        {produto.visoes.length > 1 && (
          <div className="flex gap-2 mt-6">
            {produto.visoes.map((v) => (
              <button
                key={v.id}
                onClick={() => trocarVisao(v.id)}
                className={`border-2 rounded-lg overflow-hidden w-16 h-16 ${v.id === visaoId ? "border-blue-500" : "border-transparent hover:border-slate-300"}`}
              >
                <img src={v.fotoUrl} alt={v.nome} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

function TextProperties({ obj, onChange, onCommit }: { obj: FabricText; onChange: () => void; onCommit: () => void }) {
  const [texto, setTexto] = useState(obj.text ?? "");
  const [cor, setCor] = useState((obj.fill as string) || "#111827");
  const [tamanho, setTamanho] = useState(obj.fontSize ?? 48);

  useEffect(() => { setTexto(obj.text ?? ""); setCor((obj.fill as string) || "#111827"); setTamanho(obj.fontSize ?? 48); }, [obj]);

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-slate-700">TEXT PROPERTIES</p>
      <div>
        <label className="block text-[11px] text-slate-500 mb-1">Text</label>
        <input
          className="w-full px-2 py-1.5 text-sm border rounded"
          value={texto}
          onChange={(e) => { setTexto(e.target.value); obj.set({ text: e.target.value }); onChange(); }}
          onBlur={onCommit}
        />
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-[11px] text-slate-500 mb-1">Font Size</label>
          <input
            type="number"
            className="w-full px-2 py-1.5 text-sm border rounded"
            value={tamanho}
            onChange={(e) => { const v = Number(e.target.value) || 1; setTamanho(v); obj.set({ fontSize: v }); onChange(); }}
            onBlur={onCommit}
          />
        </div>
        <div>
          <label className="block text-[11px] text-slate-500 mb-1">Cor</label>
          <input
            type="color"
            className="w-10 h-9 border rounded"
            value={cor}
            onChange={(e) => { setCor(e.target.value); obj.set({ fill: e.target.value }); onChange(); }}
            onBlur={onCommit}
          />
        </div>
      </div>
      <div className="flex gap-1.5">
        <button
          onClick={() => { obj.set({ fontWeight: obj.fontWeight === "bold" ? "normal" : "bold" }); onChange(); onCommit(); }}
          className={`flex-1 py-1.5 border rounded font-bold text-sm ${obj.fontWeight === "bold" ? "bg-blue-50 border-blue-400" : ""}`}
        >B</button>
        <button
          onClick={() => { obj.set({ fontStyle: obj.fontStyle === "italic" ? "normal" : "italic" }); onChange(); onCommit(); }}
          className={`flex-1 py-1.5 border rounded italic text-sm ${obj.fontStyle === "italic" ? "bg-blue-50 border-blue-400" : ""}`}
        >I</button>
      </div>
    </div>
  );
}

const MODOS_COR = [
  { id: "full", label: "Full Color" },
  { id: "grayscale", label: "Grayscale" },
  { id: "bw", label: "Black & White" },
  { id: "single", label: "Convert To Single Color" },
] as const;

function LogoProperties({ data, onChange, onCommit, onBrilhoChange, onRefinarIA, iaBusy, iaErro }: {
  data: LogoLayerData;
  onChange: (patch: Partial<LogoLayerData>) => void;
  onCommit: () => void;
  onBrilhoChange: (v: number) => void;
  onRefinarIA: () => void;
  iaBusy: boolean;
  iaErro: string | null;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-slate-700">IMAGE PROPERTIES</p>

      <div>
        <p className="text-[11px] text-slate-500 mb-1">Técnica</p>
        <select
          className="w-full px-2 py-1.5 text-xs border rounded"
          value={data.tecnica}
          onChange={(e) => { onChange({ tecnica: e.target.value as LogoLayerData["tecnica"] }); onCommit(); }}
        >
          {TECNICAS.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
        </select>
      </div>

      <button
        type="button"
        onClick={onRefinarIA}
        disabled={iaBusy}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100 text-xs font-medium disabled:opacity-50"
      >
        <Sparkles className="w-3.5 h-3.5" /> {iaBusy ? "Refinando..." : "Refinar com IA"}
      </button>
      {iaErro && <p className="text-[11px] text-red-600">{iaErro}</p>}

      <label className="flex items-center gap-2 text-xs text-slate-600">
        <input type="checkbox" checked={data.removerFundo} onChange={(e) => { onChange({ removerFundo: e.target.checked }); onCommit(); }} />
        Remove White Background
      </label>

      <div>
        <p className="text-[11px] text-slate-500 mb-1.5">Logo Adjust Colors</p>
        <div className="space-y-1">
          {MODOS_COR.map((m) => (
            <label key={m.id} className="flex items-center gap-2 text-xs text-slate-600">
              <input type="radio" name="modoCor" checked={data.modoCor === m.id} onChange={() => { onChange({ modoCor: m.id }); onCommit(); }} />
              {m.label}
            </label>
          ))}
          {data.modoCor === "single" && (
            <input
              type="color"
              value={data.corUnica}
              onChange={(e) => { onChange({ corUnica: e.target.value }); onCommit(); }}
              className="w-10 h-8 border rounded ml-5 mt-1"
            />
          )}
        </div>
      </div>

      <div className="pt-2 border-t">
        <p className="text-[11px] text-slate-500 mb-1">Wrap Around (curvatura)</p>
        <input
          type="range" min={0} max={1} step={0.05}
          value={data.curvatura}
          onChange={(e) => onChange({ curvatura: Number(e.target.value) })}
          onMouseUp={onCommit}
          className="w-full"
        />
        <p className="text-[10px] text-slate-400 mt-1">Faz a logo acompanhar a curvatura de um produto cilíndrico (garrafa, caneca, squeeze).</p>
      </div>

      <div className="pt-2 border-t">
        <p className="text-[11px] text-slate-500 mb-1">Brilho</p>
        <input
          type="range" min={-0.5} max={0.5} step={0.02}
          value={data.brilho}
          onChange={(e) => onBrilhoChange(Number(e.target.value))}
          onMouseUp={onCommit}
          className="w-full"
        />
      </div>
    </div>
  );
}
