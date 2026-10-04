import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { Canvas, FabricImage, controlsUtils } from "fabric";
import { Loader2, RotateCcw, RotateCw, Sparkles } from "lucide-react";
import type { CaixaPosicao, LogoOriginal, ProdutoMockup, VisaoProduto } from "./types";
import { gerarCenario } from "./gerarMockup";
import { ajustarParaBucket, escolherBucket, type AjusteBucket } from "./bucketImagem";
import { removerFundoSeOpaco } from "./composicaoLocal";

export interface ResultadoPosicionamento {
  visao: VisaoProduto;
  box: CaixaPosicao;
  cenaUrl: string;
  /** Logo recortada pelas alças, ainda reta (a rotação vai no box). */
  logoRecortada: string;
  /** Mesma logo já girada -- referência pra versão com IA. */
  logoReferencia: string;
  cenaBucketUrl: string;
  maskBucketUrl: string;
  tamanhoBucket: string;
  ajuste: AjusteBucket;
  cenaLargura: number;
  cenaAltura: number;
}

interface Props {
  produto: ProdutoMockup;
  logo: LogoOriginal;
  onVoltar: () => void;
  onContinuar: (resultado: ResultadoPosicionamento) => void;
}

interface LimitesImagem { x0: number; y0: number; x1: number; y1: number }

const CANVAS_MAX = 620;

/**
 * Etapa 3: primeiro gera (ou reaproveita do cache) o CENÁRIO em volta do
 * produto via IA -- aqui resíntese é bem-vinda, só o fundo muda, o produto
 * em si fica igual. Depois, 100% local: o vendedor posiciona a logo ORIGINAL
 * sobre esse cenário (arrastar, redimensionar, recortar bordas, girar). O
 * que ele definir aqui vira uma MÁSCARA real na Etapa 4 -- a área fora dela
 * fica garantida intocada pela própria API de edição, não por instrução.
 */
export default function EtapaPosicionamento({ produto, logo, onVoltar, onContinuar }: Props) {
  const [visaoId, setVisaoId] = useState(produto.visoes[0]?.id ?? "");
  const visaoAtual = produto.visoes.find((v) => v.id === visaoId) ?? produto.visoes[0];

  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const logoObjRef = useRef<FabricImage | null>(null);
  const limitesRef = useRef<LimitesImagem | null>(null);
  const cenaUrlRef = useRef<string | null>(null);

  const [pronto, setPronto] = useState(false);
  const [gerandoCenario, setGerandoCenario] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [gerandoRecorte, setGerandoRecorte] = useState(false);
  const [angulo, setAngulo] = useState(0);
  // null = a logo já tem transparência (não há fundo pra tirar).
  const semFundoRef = useRef<Promise<string | null> | null>(null);
  const [temFundo, setTemFundo] = useState(false);
  const [removerFundo, setRemoverFundo] = useState(true);
  const removerFundoRef = useRef(true);

  const logoEfetiva = async (): Promise<string> => {
    semFundoRef.current ??= removerFundoSeOpaco(logo.url).catch(() => null);
    const semFundo = await semFundoRef.current;
    setTemFundo(!!semFundo);
    return removerFundoRef.current && semFundo ? semFundo : logo.url;
  };

  const alternarFundo = async (remover: boolean) => {
    removerFundoRef.current = remover;
    setRemoverFundo(remover);
    const canvas = fabricRef.current;
    const logoObj = logoObjRef.current;
    if (!canvas || !logoObj) return;
    const url = await logoEfetiva();
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.src = url;
    await el.decode();
    logoObj.setElement(el, { width: logoObj.width, height: logoObj.height });
    canvas.requestRenderAll();
  };

  const carregarVisao = async (forcarNovoCenario: boolean) => {
    const canvas = fabricRef.current;
    if (!canvas || !visaoAtual) return;
    setPronto(false);
    setGerandoCenario(true);
    setErro(null);
    try {
      const { url: cenaUrl } = await gerarCenario({
        produtoUrl: visaoAtual.fotoUrl,
        nomeProduto: produto.nome,
        visaoId: visaoAtual.id,
        forcarNovo: forcarNovoCenario,
      });
      cenaUrlRef.current = cenaUrl;
      setGerandoCenario(false);

      const bgImg = await FabricImage.fromURL(cenaUrl, { crossOrigin: "anonymous" });
      const escala = Math.min(CANVAS_MAX / bgImg.width!, CANVAS_MAX / bgImg.height!, 1);
      const w = Math.round(bgImg.width! * escala);
      const h = Math.round(bgImg.height! * escala);
      canvas.setDimensions({ width: w, height: h });
      bgImg.set({ scaleX: escala, scaleY: escala, selectable: false, evented: false });
      canvas.backgroundImage = bgImg;

      canvas.remove(...canvas.getObjects());
      const logoImg = await FabricImage.fromURL(await logoEfetiva(), { crossOrigin: "anonymous" });
      const larguraNatural = logoImg.width!;
      const alturaNatural = logoImg.height!;
      limitesRef.current = { x0: 0, y0: 0, x1: larguraNatural, y1: alturaNatural };
      const escalaInicial = Math.min((w * 0.3) / larguraNatural, (h * 0.3) / alturaNatural, 1);

      // Origem no centro -- assim left/top representam o centro da logo e
      // continuam corretos mesmo girada (a rotação do Fabric é sempre em
      // torno do centro real do objeto).
      logoImg.set({
        cropX: 0, cropY: 0, width: larguraNatural, height: alturaNatural,
        left: w / 2, top: h / 2, originX: "center", originY: "center",
        scaleX: escalaInicial, scaleY: escalaInicial, angle: 0,
        cornerColor: "#2563eb", cornerStyle: "circle", transparentCorners: false, borderColor: "#2563eb",
      });
      // Alças laterais/topo/base recortam de verdade (nunca esticam) -- o
      // que sai daqui é exatamente o que vai virar a logo da máscara.
      logoImg.controls.mr.actionHandler = criarControleCorte("x", limitesRef);
      logoImg.controls.ml.actionHandler = criarControleCorte("x", limitesRef);
      logoImg.controls.mt.actionHandler = criarControleCorte("y", limitesRef);
      logoImg.controls.mb.actionHandler = criarControleCorte("y", limitesRef);

      canvas.add(logoImg);
      canvas.setActiveObject(logoImg);
      logoObjRef.current = logoImg;
      setAngulo(0);
      canvas.requestRenderAll();
      setPronto(true);
    } catch (e: any) {
      setGerandoCenario(false);
      setErro(e?.message || "Não foi possível carregar o posicionamento.");
    }
  };

  useEffect(() => {
    if (!canvasElRef.current) return;
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
    canvas.on("object:rotating", (e) => {
      const target = e.transform?.target;
      if (target) setAngulo(Math.round(target.angle));
    });

    carregarVisao(false);

    return () => {
      canvas.dispose();
      fabricRef.current = null;
      logoObjRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visaoId]);

  const girar = (delta: number) => {
    const canvas = fabricRef.current;
    const logoObj = logoObjRef.current;
    if (!canvas || !logoObj) return;
    let novo = (logoObj.angle + delta) % 360;
    if (novo > 180) novo -= 360;
    if (novo < -180) novo += 360;
    logoObj.set({ angle: novo });
    logoObj.setCoords();
    canvas.requestRenderAll();
    setAngulo(Math.round(novo));
  };

  const definirAngulo = (valor: number) => {
    const canvas = fabricRef.current;
    const logoObj = logoObjRef.current;
    if (!canvas || !logoObj) return;
    logoObj.set({ angle: valor });
    logoObj.setCoords();
    canvas.requestRenderAll();
    setAngulo(valor);
  };

  const continuar = async () => {
    const canvas = fabricRef.current;
    const logoObj = logoObjRef.current;
    const cenaUrl = cenaUrlRef.current;
    if (!canvas || !logoObj || !visaoAtual || !cenaUrl) return;
    const w = canvas.getWidth();
    const h = canvas.getHeight();
    // left/top são o CENTRO (originX/Y = center).
    const box: CaixaPosicao = {
      xPct: (logoObj.left! / w) * 100,
      yPct: (logoObj.top! / h) * 100,
      wPct: (logoObj.getScaledWidth() / w) * 100,
      hPct: (logoObj.getScaledHeight() / h) * 100,
      anguloGraus: logoObj.angle || 0,
    };

    setGerandoRecorte(true);
    try {
      const logoRecortada = await recortarLogoOriginal(await logoEfetiva(), logoObj.cropX || 0, logoObj.cropY || 0, logoObj.width!, logoObj.height!);
      // Manda a logo de REFERÊNCIA já no ângulo final -- se mandarmos reta e
      // só o buraco da máscara girado, a IA tem que "adivinhar" que precisa
      // girar; pré-girando aqui, a referência já mostra exatamente o que
      // deve aparecer dentro do buraco, sem interpretação nenhuma.
      const logoReferencia = await rotacionarLogo(logoRecortada, box.anguloGraus || 0);
      // A máscara (não mais "colar e pedir pra não mexer") é o que garante
      // de verdade que só a área marcada é editada -- contrato da API de
      // edição de imagem, não promessa do modelo.
      const maskUrl = await gerarMascara(cenaUrl, box);

      // A API só aceita alguns tamanhos fixos de saída. Se o cenário não
      // tiver exatamente essa proporção, ela reamostra por conta própria e
      // a máscara deixa de bater com o resultado -- foi isso que bagunçou a
      // mochila (alta/estreita) enquanto o copo (quase quadrado) saiu bem.
      // Preenche (sem cortar nada) até caber exato no bucket mais parecido.
      const [cenaImg, maskImg] = await Promise.all([carregarImagem(cenaUrl), carregarImagem(maskUrl)]);
      const bucket = escolherBucket(cenaImg.naturalWidth, cenaImg.naturalHeight);
      const ajusteCena = ajustarParaBucket(cenaImg, bucket, "#808080");
      const ajusteMask = ajustarParaBucket(maskImg, bucket, "#000000");

      onContinuar({
        visao: visaoAtual,
        box,
        cenaUrl,
        logoRecortada,
        logoReferencia,
        cenaBucketUrl: ajusteCena.dataUrl,
        maskBucketUrl: ajusteMask.dataUrl,
        tamanhoBucket: bucket.tamanho,
        ajuste: ajusteCena,
        cenaLargura: cenaImg.naturalWidth,
        cenaAltura: cenaImg.naturalHeight,
      });
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
        um texto que não deve entrar), ou gire pela alça de cima ou pelos controles abaixo.
      </p>

      <div className="bg-white rounded-lg shadow-[0_18px_40px_-12px_rgba(0,0,0,0.25)] relative">
        <canvas ref={canvasElRef} />
        {(gerandoCenario || (!pronto && !erro)) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 gap-2">
            <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
            {gerandoCenario && <p className="text-xs text-slate-500">Preparando o cenário...</p>}
          </div>
        )}
      </div>
      {erro && <p className="text-sm text-red-600 mt-3">{erro}</p>}

      {pronto && (
        <button
          type="button"
          onClick={() => carregarVisao(true)}
          className="flex items-center gap-1.5 mt-3 text-xs text-purple-700 hover:underline"
        >
          <Sparkles className="w-3.5 h-3.5" /> Gerar outro cenário
        </button>
      )}

      <div className="flex items-center gap-2 mt-4 bg-white border rounded-lg px-3 py-2 shadow-sm">
        <button type="button" onClick={() => girar(-90)} className="p-1.5 rounded hover:bg-slate-100" title="Girar -90°">
          <RotateCcw className="w-4 h-4" />
        </button>
        <input
          type="range" min={-180} max={180} value={angulo}
          onChange={(e) => definirAngulo(Number(e.target.value))}
          className="w-32"
        />
        <button type="button" onClick={() => girar(90)} className="p-1.5 rounded hover:bg-slate-100" title="Girar +90° (deixar na vertical)">
          <RotateCw className="w-4 h-4" />
        </button>
        <input
          type="number" value={angulo}
          onChange={(e) => definirAngulo(Number(e.target.value) || 0)}
          className="w-16 px-2 py-1 text-sm border rounded text-center"
        />
        <span className="text-sm text-slate-400">°</span>
      </div>

      {temFundo && (
        <label className="flex items-center gap-2 mt-3 text-sm text-slate-600 cursor-pointer">
          <input type="checkbox" checked={removerFundo} onChange={(e) => alternarFundo(e.target.checked)} />
          Remover o fundo chapado da logo
        </label>
      )}

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
  const img = await carregarImagem(src);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext("2d");
  if (!ctx) return src;
  ctx.drawImage(img, cropX, cropY, width, height, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

/** Gira a logo já recortada pro ângulo final, numa tela grande o bastante
 * pra não cortar os cantos -- a imagem de referência mandada pra IA já sai
 * na orientação certa, em vez dela ter que inferir a rotação pela forma do
 * buraco da máscara. */
async function rotacionarLogo(src: string, anguloGraus: number): Promise<string> {
  if (!anguloGraus) return src;
  const img = await carregarImagem(src);
  const rad = (anguloGraus * Math.PI) / 180;
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const novaLargura = Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad));
  const novaAltura = Math.abs(w * Math.sin(rad)) + Math.abs(h * Math.cos(rad));
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(novaLargura);
  canvas.height = Math.ceil(novaAltura);
  const ctx = canvas.getContext("2d");
  if (!ctx) return src;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(rad);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  return canvas.toDataURL("image/png");
}

/**
 * Gera a máscara de edição (mesma resolução do cenário): opaca em tudo
 * (preserva), com um "buraco" transparente (editável) exatamente na
 * caixa/ângulo que o vendedor definiu, com uma folga pequena (8%) só pra
 * sombra de contato respirar um pouco -- folga maior dava espaço demais
 * pra IA "crescer" a logo dentro do buraco.
 */
async function gerarMascara(cenaUrl: string, box: CaixaPosicao, folgaPct = 0.08): Promise<string> {
  const img = await carregarImagem(cenaUrl);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível gerar a máscara.");

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const cx = (box.xPct / 100) * canvas.width;
  const cy = (box.yPct / 100) * canvas.height;
  const w = ((box.wPct / 100) * canvas.width) * (1 + folgaPct * 2);
  const h = ((box.hPct / 100) * canvas.height) * (1 + folgaPct * 2);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(((box.anguloGraus || 0) * Math.PI) / 180);
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.restore();

  return canvas.toDataURL("image/png");
}

function carregarImagem(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = src;
  return new Promise((resolve, reject) => {
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Não foi possível carregar a imagem."));
  });
}

/**
 * Alça lateral/topo/base: ajusta width/cropX (ou height/cropY) diretamente,
 * nunca scaleX/scaleY -- por isso não distorce a logo, só recorta. O lado
 * oposto ao que está sendo arrastado funciona como âncora fixa (padrão do
 * Fabric pra controles de borda), e o crop nunca passa dos limites reais da
 * imagem original. Funciona com a logo girada também -- getLocalPoint já
 * devolve a posição do cursor no referencial (não rotacionado) do objeto.
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
