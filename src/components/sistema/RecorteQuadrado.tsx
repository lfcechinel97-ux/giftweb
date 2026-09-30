import { useEffect, useMemo, useRef, useState } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * Recorte quadrado do mockup antes de subir — "quando o vendedor adiciona
 * o mockup, aparece a opção de recortar um quadrado menor, pra deixar o
 * produto bem aparente sem bordas". Sem lib externa: arrasta a imagem
 * dentro de uma janela quadrada fixa (como recorte de foto de perfil) e
 * dá zoom; ao confirmar, desenha só o que está dentro da janela num
 * canvas e devolve isso como arquivo.
 */

const JANELA = 320; // px do quadrado de recorte na tela
const SAIDA = 900;  // px do lado do quadrado exportado

interface Props {
  arquivo: File | null;
  onCancelar: () => void;
  onConfirmar: (arquivoRecortado: File) => void;
}

export default function RecorteQuadrado({ arquivo, onCancelar, onConfirmar }: Props) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1); // 1 = "cover" mínimo da janela
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const arrastoRef = useRef<{ x: number; y: number; offX: number; offY: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!arquivo) { setImg(null); return; }
    const url = URL.createObjectURL(arquivo);
    const el = new Image();
    el.onload = () => { setImg(el); setZoom(1); setOffset({ x: 0, y: 0 }); };
    el.src = url;
    return () => URL.revokeObjectURL(url);
  }, [arquivo]);

  // Escala mínima: a menor dimensão da imagem preenche a janela (como object-fit: cover).
  const escalaBase = useMemo(() => {
    if (!img) return 1;
    return JANELA / Math.min(img.naturalWidth, img.naturalHeight);
  }, [img]);

  const escala = escalaBase * zoom;
  const largura = img ? img.naturalWidth * escala : 0;
  const altura = img ? img.naturalHeight * escala : 0;

  const clamp = (o: { x: number; y: number }, larg: number, alt: number) => ({
    x: Math.min(0, Math.max(JANELA - larg, o.x)),
    y: Math.min(0, Math.max(JANELA - alt, o.y)),
  });

  // Reclampa quando o zoom muda (evita a imagem "escapar" da janela).
  useEffect(() => {
    setOffset(o => clamp(o, largura, altura));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [largura, altura]);

  const iniciarArrasto = (clientX: number, clientY: number) => {
    arrastoRef.current = { x: clientX, y: clientY, offX: offset.x, offY: offset.y };
  };
  const moverArrasto = (clientX: number, clientY: number) => {
    if (!arrastoRef.current) return;
    const dx = clientX - arrastoRef.current.x;
    const dy = clientY - arrastoRef.current.y;
    setOffset(clamp({ x: arrastoRef.current.offX + dx, y: arrastoRef.current.offY + dy }, largura, altura));
  };
  const pararArrasto = () => { arrastoRef.current = null; };

  const confirmar = () => {
    if (!img || !arquivo) return;
    const sx = -offset.x / escala;
    const sy = -offset.y / escala;
    const sLado = JANELA / escala;
    const canvas = document.createElement("canvas");
    canvas.width = SAIDA;
    canvas.height = SAIDA;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, sx, sy, sLado, sLado, 0, 0, SAIDA, SAIDA);
    canvas.toBlob(blob => {
      if (!blob) return;
      const nomeBase = arquivo.name.replace(/\.[^.]+$/, "") || "mockup";
      onConfirmar(new File([blob], `${nomeBase}-recortado.jpg`, { type: "image/jpeg" }));
    }, "image/jpeg", 0.92);
  };

  return (
    <Dialog open={!!arquivo} onOpenChange={open => !open && onCancelar()}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Recortar mockup</DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground -mt-2">
          Arraste a imagem para posicionar o produto dentro do quadrado. Use o zoom para aproximar.
        </p>

        <div
          ref={containerRef}
          className="relative mx-auto overflow-hidden rounded-lg border border-border bg-muted select-none touch-none"
          style={{ width: JANELA, height: JANELA, cursor: img ? "grab" : "default" }}
          onMouseDown={e => { e.preventDefault(); iniciarArrasto(e.clientX, e.clientY); }}
          onMouseMove={e => moverArrasto(e.clientX, e.clientY)}
          onMouseUp={pararArrasto}
          onMouseLeave={pararArrasto}
          onTouchStart={e => { const t = e.touches[0]; iniciarArrasto(t.clientX, t.clientY); }}
          onTouchMove={e => { const t = e.touches[0]; moverArrasto(t.clientX, t.clientY); }}
          onTouchEnd={pararArrasto}
        >
          {img && (
            <img
              src={img.src}
              alt=""
              draggable={false}
              className="absolute top-0 left-0 max-w-none pointer-events-none"
              style={{ width: largura, height: altura, transform: `translate(${offset.x}px, ${offset.y}px)` }}
            />
          )}
        </div>

        <div className="flex items-center gap-2">
          <ZoomOut className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={e => setZoom(Number(e.target.value))}
            className="flex-1"
          />
          <ZoomIn className="h-4 w-4 text-muted-foreground shrink-0" />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancelar}>Cancelar</Button>
          <Button onClick={confirmar} disabled={!img}>Usar recorte</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
