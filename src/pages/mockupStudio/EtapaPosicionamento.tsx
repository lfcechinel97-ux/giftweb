import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { Canvas, FabricImage, controlsUtils } from "fabric";
import { Loader2 } from "lucide-react";
import type { CaixaPosicao, LogoOriginal, ProdutoMockup, VisaoProduto } from "./types";
import { removerFundoLocal, type CaixaConteudo } from "./floodFill";

interface Props {
  produto: ProdutoMockup;
  logo: LogoOriginal;
  onVoltar: () => void;
  onContinuar: (visao: VisaoProduto, box: CaixaPosicao) => void;
}

const CANVAS_MAX = 620;

/**
 * Etapa 3: posicionamento 100% local, sem IA nenhuma. A logo aqui (com
 * fundo removido por flood fill) é só um GUIA visual de tamanho/posição --
 * o arquivo mandado pra geração final na Etapa 4 é sempre a logo original.
 */
export default function EtapaPosicionamento({ produto, logo, onVoltar, onContinuar }: Props) {
  const [visaoId, setVisaoId] = useState(produto.visoes[0]?.id ?? "");
  const visaoAtual = produto.visoes.find((v) => v.id === visaoId) ?? produto.visoes[0];

  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const logoObjRef = useRef<FabricImage | null>(null);
  const caixaConteudoRef = useRef<CaixaConteudo | null>(null);

  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!canvasElRef.current) return;
    let cancelado = false;
    setPronto(false);
    setErro(null);

    const canvas = new Canvas(canvasElRef.current, { preserveObjectStacking: true });
    fabricRef.current = canvas;

    // Cantos (tl/tr/bl/br) sempre travam proporção -- redimensiona a logo
    // mantendo o conteúdo inteiro, sem distorcer.
    canvas.on("object:scaling", (e) => {
      const target = e.transform?.target;
      const corner = e.transform?.corner;
      const ehCanto = corner === "tl" || corner === "tr" || corner === "bl" || corner === "br";
      if (target && ehCanto && e.e && !(e.e as MouseEvent).shiftKey) target.scaleY = target.scaleX;
    });

    (async () => {
      try {
        if (!visaoAtual) return;
        const bgImg = await FabricImage.fromURL(visaoAtual.fotoUrl, { crossOrigin: "anonymous" });
        if (cancelado) return;
        const escala = Math.min(CANVAS_MAX / bgImg.width!, CANVAS_MAX / bgImg.height!, 1);
        const w = Math.round(bgImg.width! * escala);
        const h = Math.round(bgImg.height! * escala);
        canvas.setDimensions({ width: w, height: h });
        bgImg.set({ scaleX: escala, scaleY: escala, selectable: false, evented: false });
        canvas.backgroundImage = bgImg;

        const resultado = await removerFundoLocal(logo.url);
        if (cancelado) return;
        caixaConteudoRef.current = resultado.caixa;

        const logoImg = await FabricImage.fromURL(resultado.previewUrl, { crossOrigin: "anonymous" });
        if (cancelado) return;

        const larguraConteudo = resultado.caixa.x1 - resultado.caixa.x0;
        const alturaConteudo = resultado.caixa.y1 - resultado.caixa.y0;
        const escalaInicial = Math.min((w * 0.3) / larguraConteudo, (h * 0.3) / alturaConteudo);

        logoImg.set({
          cropX: resultado.caixa.x0,
          cropY: resultado.caixa.y0,
          width: larguraConteudo,
          height: alturaConteudo,
          left: (w - larguraConteudo * escalaInicial) / 2,
          top: (h - alturaConteudo * escalaInicial) / 2,
          originX: "left",
          originY: "top",
          scaleX: escalaInicial,
          scaleY: escalaInicial,
          cornerColor: "#2563eb",
          cornerStyle: "circle",
          transparentCorners: false,
          borderColor: "#2563eb",
          lockRotation: true,
        });
        // Alças laterais/topo/base recortam o conteúdo em vez de esticar --
        // nunca passam dos limites reais detectados pelo flood fill.
        logoImg.controls.mr.actionHandler = criarControleCorte("x", caixaConteudoRef);
        logoImg.controls.ml.actionHandler = criarControleCorte("x", caixaConteudoRef);
        logoImg.controls.mt.actionHandler = criarControleCorte("y", caixaConteudoRef);
        logoImg.controls.mb.actionHandler = criarControleCorte("y", caixaConteudoRef);
        logoImg.controls.mtr.visible = false;

        canvas.add(logoImg);
        canvas.setActiveObject(logoImg);
        logoObjRef.current = logoImg;
        canvas.requestRenderAll();
        setPronto(true);
      } catch (e: any) {
        if (!cancelado) setErro(e?.message || "Não foi possível carregar o posicionamento.");
      }
    })();

    return () => {
      cancelado = true;
      canvas.dispose();
      fabricRef.current = null;
      logoObjRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visaoId]);

  const continuar = () => {
    const canvas = fabricRef.current;
    const logoObj = logoObjRef.current;
    if (!canvas || !logoObj || !visaoAtual) return;
    const w = canvas.getWidth();
    const h = canvas.getHeight();
    const box: CaixaPosicao = {
      xPct: (logoObj.left! / w) * 100,
      yPct: (logoObj.top! / h) * 100,
      wPct: (logoObj.getScaledWidth() / w) * 100,
      hPct: (logoObj.getScaledHeight() / h) * 100,
    };
    onContinuar(visaoAtual, box);
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 flex flex-col items-center">
      <h2 className="text-lg font-semibold text-slate-800 mb-1 self-start">Posicionar a logo</h2>
      <p className="text-sm text-slate-500 mb-4 self-start">
        Arraste pra mover, puxe os cantos pra redimensionar proporcionalmente, puxe as bordas pra recortar sem distorcer.
        Isso é só um guia -- o mockup final sai pronto da IA na próxima etapa.
      </p>

      <div className="bg-white rounded-lg shadow-[0_18px_40px_-12px_rgba(0,0,0,0.25)] relative">
        <canvas ref={canvasElRef} />
        {!pronto && !erro && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
          </div>
        )}
      </div>
      {erro && <p className="text-sm text-red-600 mt-3">{erro}</p>}

      {produto.visoes.length > 1 && (
        <div className="flex gap-2 mt-4">
          {produto.visoes.map((v) => (
            <button
              key={v.id}
              onClick={() => setVisaoId(v.id)}
              className={`border-2 rounded-lg overflow-hidden w-14 h-14 ${v.id === visaoId ? "border-blue-500" : "border-transparent hover:border-slate-300"}`}
            >
              <img src={v.fotoUrl} alt={v.nome} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}

      <div className="mt-8 flex gap-3 self-end">
        <button type="button" onClick={onVoltar} className="px-5 py-2.5 rounded-lg border text-sm font-medium hover:bg-slate-50">
          Voltar
        </button>
        <button
          type="button"
          disabled={!pronto}
          onClick={continuar}
          className="px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-40"
        >
          Gerar mockup final
        </button>
      </div>
    </div>
  );
}

/**
 * Alça lateral/topo/base: ajusta width/cropX (ou height/cropY) diretamente,
 * nunca scaleX/scaleY -- por isso não distorce a logo, só recorta. O lado
 * oposto ao que está sendo arrastado funciona como âncora fixa (padrão do
 * Fabric pra controles de borda), e o crop nunca passa dos limites reais do
 * conteúdo detectados pelo flood fill (caixaConteudoRef).
 */
function criarControleCorte(eixo: "x" | "y", caixaRef: MutableRefObject<CaixaConteudo | null>) {
  const handler = (_eventData: any, transform: any, x: number, y: number) => {
    const target = transform.target as FabricImage;
    const caixa = caixaRef.current;
    if (!caixa) return false;
    const localPoint = controlsUtils.getLocalPoint(transform, transform.originX, transform.originY, x, y);

    if (eixo === "x") {
      const scaleX = target.scaleX || 1;
      const limiteMin = caixa.x0;
      const limiteMax = caixa.x1;
      if (transform.originX === "left") {
        // arrastando a alça direita: corta a partir da direita
        const cropX = target.cropX ?? caixa.x0;
        const novaLargura = Math.max(4, Math.min(Math.abs(localPoint.x) / scaleX, limiteMax - cropX));
        target.set({ width: novaLargura });
      } else if (transform.originX === "right") {
        // arrastando a alça esquerda: a borda direita do crop fica fixa
        const cropAtual = target.cropX ?? caixa.x0;
        const larguraAtual = target.width!;
        const bordaDireita = cropAtual + larguraAtual;
        const novoCropX = Math.max(limiteMin, Math.min(bordaDireita - 4, bordaDireita - Math.abs(localPoint.x) / scaleX));
        target.set({ cropX: novoCropX, width: bordaDireita - novoCropX });
      }
    } else {
      const scaleY = target.scaleY || 1;
      const limiteMin = caixa.y0;
      const limiteMax = caixa.y1;
      if (transform.originY === "top") {
        const cropY = target.cropY ?? caixa.y0;
        const novaAltura = Math.max(4, Math.min(Math.abs(localPoint.y) / scaleY, limiteMax - cropY));
        target.set({ height: novaAltura });
      } else if (transform.originY === "bottom") {
        const cropAtual = target.cropY ?? caixa.y0;
        const alturaAtual = target.height!;
        const bordaBaixo = cropAtual + alturaAtual;
        const novoCropY = Math.max(limiteMin, Math.min(bordaBaixo - 4, bordaBaixo - Math.abs(localPoint.y) / scaleY));
        target.set({ cropY: novoCropY, height: bordaBaixo - novoCropY });
      }
    }
    target.setCoords();
    return true;
  };
  return controlsUtils.wrapWithFireEvent("resizing", controlsUtils.wrapWithFixedAnchor(handler));
}
