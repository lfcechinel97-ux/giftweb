import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { LogoOriginal, LogoTratada, Tecnica } from "./types";

/**
 * Tratamento desta primeira versão do Mockup Studio: processamento gráfico
 * DETERMINÍSTICO, local, sem IA — por isso é seguro rodar automaticamente.
 * Laser converte pra escala de cinza preservando o canal alpha (não redesenha
 * nada, só remove cor). DTF UV/Têxtil preservam a arte original; remoção de
 * fundo e geração por IA entram numa etapa futura do projeto, e por isso não
 * fingem acontecer aqui.
 */
async function processarLogo(logo: LogoOriginal, tecnica: Tecnica): Promise<LogoTratada> {
  if (tecnica !== "laser") {
    return { url: logo.url, tecnica };
  }

  const img = new Image();
  img.src = logo.url;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Não foi possível ler a imagem."));
  });

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível neste navegador.");
  ctx.drawImage(img, 0, 0);

  const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = frame.data;
  let pixelsVisiveis = 0;
  for (let i = 0; i < d.length; i += 4) {
    const alpha = d[i + 3];
    if (alpha > 10) pixelsVisiveis++;
    // Luminância perceptual -- preserva o alpha original (transparência).
    const cinza = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    // Simulação prateada/brilhante: realça o contraste em torno do meio-tom.
    const realcado = Math.min(255, Math.max(0, (cinza - 128) * 1.15 + 128 + 25));
    d[i] = d[i + 1] = d[i + 2] = realcado;
  }
  ctx.putImageData(frame, 0, 0);

  const avisoQualidade = pixelsVisiveis / (canvas.width * canvas.height) < 0.01
    ? "A arte ficou com pouquíssimo conteúdo visível depois da conversão — revise o arquivo original antes de aprovar."
    : undefined;

  return { url: canvas.toDataURL("image/png"), tecnica, avisoQualidade };
}

interface Props {
  logo: LogoOriginal;
  tecnica: Tecnica;
  onPronto: (tratada: LogoTratada) => void;
  onVoltar: () => void;
}

export default function EtapaTratamento({ logo, tecnica, onPronto, onVoltar }: Props) {
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    setErro(null);
    processarLogo(logo, tecnica)
      .then((tratada) => { if (!cancelado) onPronto(tratada); })
      .catch((e: Error) => { if (!cancelado) setErro(e.message || "Falha ao processar a logo."); });
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logo, tecnica]);

  if (erro) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center">
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{erro}</p>
        <button type="button" onClick={onVoltar} className="mt-4 px-5 py-2.5 rounded-lg border text-sm font-medium hover:bg-slate-50">
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto py-20 px-4 flex flex-col items-center text-center">
      <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-4" />
      <p className="text-sm text-slate-600">Preparando a arte...</p>
    </div>
  );
}
