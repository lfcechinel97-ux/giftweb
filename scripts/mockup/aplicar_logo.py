"""Aplica logo ficticia numa foto de produto simulando tecnicas de gravacao.

Tecnicas simuladas:
  silk / dtf  -> tinta opaca colorida sobre o produto
  uv          -> impressao colorida nitida, leve brilho
  laser       -> gravacao monocromatica, tom sobre tom (nao adiciona cor)
"""
from __future__ import annotations

import numpy as np
from PIL import Image, ImageDraw, ImageFont

from .logos import WIN_FONTS, Marca


def _fonte(nome: str, tamanho: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(WIN_FONTS + nome, tamanho)


def render_marca(marca: Marca, largura_alvo: int) -> Image.Image:
    """Desenha a logo (texto + marcador) num RGBA transparente, ajustada a largura_alvo."""
    tam = 100
    f = _fonte(marca.fonte, tam)
    texto = marca.nome if marca.caixa_alta else marca.nome.title()

    # mede com espacamento entre letras
    larguras = [f.getbbox(ch)[2] - f.getbbox(ch)[0] for ch in texto]
    esp = marca.espacamento * 2
    larg_texto = sum(larguras) + esp * max(0, len(texto) - 1)
    alt_texto = f.getbbox("Hg")[3] - f.getbbox("Hg")[1]

    pad = int(tam * 0.35)
    marcador_w = int(tam * 0.95) if marca.marcador != "none" else 0
    W = larg_texto + marcador_w + pad
    H = int(alt_texto * 2.0)

    img = Image.new("RGBA", (max(W, 10), max(H, 10)), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cy = H // 2
    x = 0

    # marcador geometrico a esquerda
    if marca.marcador != "none":
        s = int(tam * 0.62)
        y0 = cy - s // 2
        if marca.marcador == "square":
            d.rounded_rectangle([x, y0, x + s, y0 + s], radius=int(s * 0.18), fill=marca.cor + (255,))
        elif marca.marcador == "circle":
            d.ellipse([x, y0, x + s, y0 + s], outline=marca.cor + (255,), width=int(s * 0.22))
        elif marca.marcador == "dot":
            d.ellipse([x, y0, x + s, y0 + s], fill=marca.cor + (255,))
        elif marca.marcador == "bar":
            bw = int(s * 0.30)
            d.rounded_rectangle([x, y0, x + bw, y0 + s], radius=bw // 2, fill=marca.cor + (255,))
        x += marcador_w

    # texto com espacamento manual
    ty = cy - alt_texto // 2 - f.getbbox("Hg")[1]
    for i, ch in enumerate(texto):
        d.text((x, ty), ch, font=f, fill=marca.cor + (255,))
        x += larguras[i] + (esp if i < len(texto) - 1 else 0)

    img = img.crop(img.getbbox())
    escala = largura_alvo / img.width
    return img.resize((largura_alvo, max(1, round(img.height * escala))), Image.LANCZOS)


def _caixa_produto(foto: Image.Image, limiar: int = 244) -> tuple[int, int, int, int]:
    """Bounding box do produto (area nao-branca)."""
    g = np.asarray(foto.convert("L"))
    mask = g < limiar
    ys, xs = np.where(mask)
    if len(xs) == 0:
        w, h = foto.size
        return (w // 4, h // 4, 3 * w // 4, 3 * h // 4)
    return (int(xs.min()), int(ys.min()), int(xs.max()), int(ys.max()))


def _faixa_corpo(foto: Image.Image, top: int, altura: int) -> tuple[int, int]:
    """Dentro de uma faixa horizontal, acha o maior trecho continuo de produto.
    Evita colar a logo em cima de alca, cordao ou bico separados por vao branco."""
    g = np.asarray(foto.convert("L"))
    faixa = g[top:top + altura, :]
    col_produto = (faixa < 244).mean(axis=0) > 0.55
    melhor_ini, melhor_len, ini = 0, 0, None
    for i, v in enumerate(col_produto):
        if v and ini is None:
            ini = i
        elif not v and ini is not None:
            if i - ini > melhor_len:
                melhor_ini, melhor_len = ini, i - ini
            ini = None
    if ini is not None and len(col_produto) - ini > melhor_len:
        melhor_ini, melhor_len = ini, len(col_produto) - ini
    return melhor_ini, melhor_ini + melhor_len


def _area_impressao(foto: Image.Image) -> tuple[int, int, int, int]:
    """Faixa horizontal mais cheia/uniforme do produto, restrita ao corpo continuo."""
    x0, y0, x1, y1 = _caixa_produto(foto)
    g = np.asarray(foto.convert("L")).astype(np.float64)
    alt = y1 - y0
    melhor, melhor_score = None, -1e18
    passo = max(2, alt // 60)
    janela = max(8, alt // 6)
    for top in range(y0 + int(alt * 0.12), max(y0 + int(alt * 0.13), y1 - janela - int(alt * 0.10)), passo):
        cx0, cx1 = _faixa_corpo(foto, top, janela)
        if cx1 - cx0 < (x1 - x0) * 0.25:
            continue
        faixa = g[top:top + janela, cx0:cx1]
        if faixa.size == 0:
            continue
        preenchimento = (faixa < 244).mean()
        uniformidade = -faixa.std() / 128.0
        largura_rel = (cx1 - cx0) / max(1, (x1 - x0))
        centralidade = 1.0 - abs(((top + janela / 2) - (y0 + alt / 2)) / (alt / 2))
        score = preenchimento * 2.2 + uniformidade * 1.1 + centralidade * 0.6 + largura_rel * 1.4
        if score > melhor_score:
            melhor_score, melhor = score, (top, janela, cx0, cx1)
    if melhor is None:
        return (x0, y0 + alt // 3, x1, y0 + alt // 3 + max(8, alt // 6))
    top, janela, cx0, cx1 = melhor
    return (cx0, top, cx1, top + janela)


def aplicar(foto: Image.Image, marca: Marca, tecnica: str = "silk",
            proporcao: float = 0.60) -> Image.Image:
    """Compoe a logo na foto do produto. proporcao = largura da logo / largura do corpo."""
    foto = foto.convert("RGB")
    px0, py0, px1, py1 = _area_impressao(foto)
    larg_corpo = px1 - px0

    logo_w = max(28, int(larg_corpo * proporcao))
    logo = render_marca(marca, logo_w)

    faixa_h = py1 - py0
    if logo.height > faixa_h * 1.15:
        f = (faixa_h * 1.15) / logo.height
        logo = logo.resize((max(1, int(logo.width * f)), max(1, int(logo.height * f))), Image.LANCZOS)

    cx = (px0 + px1) // 2 - logo.width // 2
    cy = (py0 + py1) // 2 - logo.height // 2
    cx = max(0, min(cx, foto.width - logo.width))
    cy = max(0, min(cy, foto.height - logo.height))

    base = foto.copy()
    regiao = base.crop((cx, cy, cx + logo.width, cy + logo.height))
    lum = np.asarray(regiao.convert("L")).astype(np.float64) / 255.0
    fundo_escuro = lum.mean() < 0.5

    alpha = np.asarray(logo.split()[-1]).astype(np.float64) / 255.0
    rgb = np.asarray(logo.convert("RGB")).astype(np.float64)
    reg = np.asarray(regiao).astype(np.float64)

    if tecnica == "laser":
        # gravacao tom sobre tom: clareia em superficie escura, escurece em clara
        if fundo_escuro:
            alvo = np.clip(reg * 1.70 + 88.0, 0, 255)
        else:
            alvo = reg * 0.42
        forca = 0.95
        out = reg * (1 - alpha[..., None] * forca) + alvo * (alpha[..., None] * forca)
    else:
        # silk / dtf / uv: tinta real. Em produto escuro usa-se base branca,
        # entao a tinta aparece clara - e assim que sai na pratica.
        if fundo_escuro:
            tinta = np.clip(rgb * 0.35 + 205.0, 0, 255)
        else:
            tinta = rgb
        forca = 0.97 if tecnica == "uv" else 0.94
        out = reg * (1 - alpha[..., None] * forca) + tinta * (alpha[..., None] * forca)

    # acompanha o sombreado do produto (cilindro escurece nas bordas)
    sombra = np.clip(lum * 0.9 + 0.55, 0.72, 1.18)[..., None]
    out = np.clip(out * sombra, 0, 255)

    base.paste(Image.fromarray(out.astype(np.uint8)), (cx, cy))
    return base
