import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { Canvas, FabricImage, controlsUtils } from "fabric";
import { Loader2 } from "lucide-react";
import type { CaixaPosicao, LogoOriginal, ProdutoMockup, VisaoProduto } from "./types";

interface Props {
  produto: ProdutoMockup;
  logo: LogoOriginal;
  onVoltar: () => void;
  onContinuar: (visao: VisaoProduto, box: CaixaPosicao, logoRecortada: string, imagemGuia: string) => void;
}

interface LimitesImagem { x0: number; y0: number; x1: number; y1: number }

const CANVAS_MAX = 620;

/**
 * Etapa 3: posicionamento 100% local, sem IA nenhuma. Mostra a logo
 * ORIGINAL (sem remover fundo -- isso deixava a prévia feia e não refletia
 * o que a IA ia receber). O que o vendedor recortar aqui com as alças de
 * borda sai recortado de verdade no arquivo mandado pra Etapa 4 -- não é só
 * um guia visual, é o crop real (ex.: cortar um texto indesejado da logo).
 */
export default function EtapaPosicionamento({ produto, logo, onVoltar, onContinuar }: Props) {
  const [visaoId, setVisaoId] = useState(produto.visoes[0]?.id ?? "");
  const visaoAtual = produto.visoes.find((v) => v.id === visaoId) ?? produto.visoes[0];

  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const logoObjRef = useRef<FabricImage | null>(null);
  const limitesRef = useRef<LimitesImagem | null>(null);

  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [gerandoRecorte, setGerandoRecorte] = useState(false);

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

        const logoImg = await FabricImage.fromURL(logo.url, { crossOrigin: "anonymous" });
        if (cancelado) return;

        const larguraNatural = logoImg.width!;
        const alturaNatural = logoImg.height!;
        limitesRef.current = { x0: 0, y0: 0, x1: larguraNatural, y1: alturaNatural };
        const escalaInicial = Math.min((w * 0.3) / larguraNatural, (h * 0.3) / alturaNatural, 1);

        logoImg.set({
          cropX: 0,
          cropY: 0,
          width: larguraNatural,
          height: alturaNatural,
          left: (w - larguraNatural * escalaInicial) / 2,
          top: (h - alturaNatural * escalaInicial) / 2,
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
        // Alças laterais/topo/base recortam de verdade (nunca esticam) --
        // o que sai daqui é exatamente o que vai pra geração final.
        logoImg.controls.mr.actionHandler = criarControleCorte("x", limitesRef);
        logoImg.controls.ml.actionHandler = criarControleCorte("x", limitesRef);
        logoImg.controls.mt.actionHandler = criarControleCorte("y", limitesRef);
        logoImg.controls.mb.actionHandler = criarControleCorte("y", limitesRef);
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

  const continuar = async () => {
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

    setGerandoRecorte(true);
    try {
      const [logoRecortada, imagemGuia] = await Promise.all([
        recortarLogoOriginal(logo.url, logoObj.cropX || 0, logoObj.cropY || 0, logoObj.width!, logoObj.height!),
        gerarImagemGuia(visaoAtual.fotoUrl, box),
      ]);
      onContinuar(visaoAtual, box, logoRecortada, imagemGuia);
    } catch (e: any) {
      setErro(e?.message || "Não foi possível preparar os arquivos.");
    } finally {
      setGerandoRecorte(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 flex flex-col items-center">
      <h2 className="text-lg font-semibold text-slate-800 mb-1 self-start">Posicionar a logo</h2>
      <p className="text-sm text-slate-500 mb-4 self-start">
        Arraste pra mover, puxe os cantos pra redimensionar proporcionalmente, puxe as bordas pra recortar (ex.: tirar
        um texto que não deve entrar). O que você recortar aqui é exatamente o que vai pra geração final.
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
          disabled={!pronto || gerandoRecorte}
          onClick={continuar}
          className="px-5 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-40"
        >
          {gerandoRecorte ? "Preparando..." : "Gerar mockup final"}
        </button>
      </div>
    </div>
  );
}

/** Recorta a logo ORIGINAL (não a prévia em tela) na resolução nativa, pela
 * janela cropX/cropY/width/height que o vendedor definiu com as alças. */
async function recortarLogoOriginal(src: string, cropX: number, cropY: number, width: number, height: number): Promise<string> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = src;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Não foi possível reler a logo original."));
  });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext("2d");
  if (!ctx) return src;
  ctx.drawImage(img, cropX, cropY, width, height, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

/**
 * Desenha um retângulo tracejado na foto do produto (resolução nativa),
 * exatamente no lugar/tamanho que o vendedor definiu -- modelos de geração
 * de imagem seguem marcação visual muito melhor do que porcentagem em
 * texto, que é o que causava a IA ignorando o tamanho/posição pedidos.
 */
async function gerarImagemGuia(produtoUrl: string, box: CaixaPosicao): Promise<string> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = produtoUrl;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Não foi possível reler a foto do produto."));
  });
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return produtoUrl;
  ctx.drawImage(img, 0, 0);

  const x = (box.xPct / 100) * canvas.width;
  const y = (box.yPct / 100) * canvas.height;
  const w = (box.wPct / 100) * canvas.width;
  const h = (box.hPct / 100) * canvas.height;
  const espessura = Math.max(2, canvas.width * 0.004);
  ctx.strokeStyle = "#ff00ff";
  ctx.lineWidth = espessura;
  ctx.setLineDash([espessura * 2.5, espessura * 2.5]);
  ctx.strokeRect(x, y, w, h);

  return canvas.toDataURL("image/png");
}

/**
 * Alça lateral/topo/base: ajusta width/cropX (ou height/cropY) diretamente,
 * nunca scaleX/scaleY -- por isso não distorce a logo, só recorta. O lado
 * oposto ao que está sendo arrastado funciona como âncora fixa (padrão do
 * Fabric pra controles de borda), e o crop nunca passa dos limites reais da
 * imagem original.
 */
function criarControleCorte(eixo: "x" | "y", limitesRef: MutableRefObject<LimitesImagem | null>) {
  const handler = (_eventData: any, transform: any, x: number, y: number) => {
    const target = transform.target as FabricImage;
    const limites = limitesRef.current;
    if (!limites) return false;
    const localPoint = controlsUtils.getLocalPoint(transform, transform.originX, transform.originY, x, y);

    if (eixo === "x") {
      const scaleX = target.scaleX || 1;
      const limiteMin = limites.x0;
      const limiteMax = limites.x1;
      if (transform.originX === "left") {
        // arrastando a alça direita: corta a partir da direita
        const cropX = target.cropX ?? limites.x0;
        const novaLargura = Math.max(4, Math.min(Math.abs(localPoint.x) / scaleX, limiteMax - cropX));
        target.set({ width: novaLargura });
      } else if (transform.originX === "right") {
        // arrastando a alça esquerda: a borda direita do crop fica fixa
        const cropAtual = target.cropX ?? limites.x0;
        const larguraAtual = target.width!;
        const bordaDireita = cropAtual + larguraAtual;
        const novoCropX = Math.max(limiteMin, Math.min(bordaDireita - 4, bordaDireita - Math.abs(localPoint.x) / scaleX));
        target.set({ cropX: novoCropX, width: bordaDireita - novoCropX });
      }
    } else {
      const scaleY = target.scaleY || 1;
      const limiteMin = limites.y0;
      const limiteMax = limites.y1;
      if (transform.originY === "top") {
        const cropY = target.cropY ?? limites.y0;
        const novaAltura = Math.max(4, Math.min(Math.abs(localPoint.y) / scaleY, limiteMax - cropY));
        target.set({ height: novaAltura });
      } else if (transform.originY === "bottom") {
        const cropAtual = target.cropY ?? limites.y0;
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
