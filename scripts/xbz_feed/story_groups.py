"""Grupos dos stories do catalogo HTML.

Os stories sao uma camada de navegacao PROPRIA, independente das secoes da
pagina: as secoes continuam nas 10 categorias amplas do CSV, e os stories
quebram isso em 17 grupos mais especificos (definidos pelo usuario).
Clicar num story filtra o catalogo por esse grupo.
"""
from __future__ import annotations

import re
import unicodedata
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


def slug(txt: str) -> str:
    n = unicodedata.normalize("NFD", txt.lower())
    n = "".join(c for c in n if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", "-", n).strip("-")


# (rotulo, subcategorias que caem no grupo, codigos forcados)
# A ordem aqui e a ordem em que os stories aparecem.
GRUPOS: list[tuple[str, list[str], list[str]]] = [
    ("Garrafas",            ["Garrafas Térmicas / Squeezes", "Garrafas de Inox / Alumínio"], ["14794", "06033", "18921"]),
    ("Copos e Canecas",     ["Copos", "Canecas"], []),
    ("Mochilas",            ["Mochilas e Sacochilas"], ["01318"]),
    ("Bolsas Térmicas",     ["Bolsas Térmicas"], []),
    ("Guarda-Chuvas",       ["Guarda-Chuvas"], []),
    ("Kit Vinho e Churrasco", ["Kit Vinho", "Kit Churrasco"], []),
    ("Necessaires e Porta Joias", ["Necessaires", "Porta Joias", "Kit Manicure"], []),
    ("Cadernetas",          ["Cadernetas", "Blocos de Anotações"], []),
    ("Canetas",             ["Canetas"], []),
    ("Chaveiros",           ["Chaveiros"], []),
    ("Mouse Pad",           ["Mouse Pad"], []),
    ("Kit Executivo",       ["Kit Executivo"], []),
    ("Som e Power Bank",    ["Caixas de Som", "Fones de Ouvido", "Power Banks"], []),
    ("Sacolas",             ["Sacolas de Algodão e TNT"], []),
    ("Tábuas",              ["Tábuas e Petisqueiras"], []),
    ("Marmitas",            ["Marmitas"], []),
    ("Malas de Viagem",     ["Malas de Viagem"], []),
]


def grupo_do_produto(codigo: str, subcategoria: str) -> str | None:
    """Codigo forcado tem prioridade sobre a subcategoria (ex: a 'caneca termica
    1,2L' e o Quencher 06033, que o usuario quer em Garrafas e nao em Canecas)."""
    for rotulo, _subs, codigos in GRUPOS:
        if codigo in codigos:
            return rotulo
    for rotulo, subs, _c in GRUPOS:
        if subcategoria in subs:
            return rotulo
    return None


def recortar_fundo(im: Image.Image) -> Image.Image:
    """Remove o fundo branco por flood fill a partir das bordas, para a imagem
    poder transbordar o circulo do story. Nao fura areas brancas internas do
    produto porque so remove o branco conectado a borda."""
    im = im.convert("RGB")
    w, h = im.size
    canvas = Image.new("RGB", (w + 2, h + 2), (255, 255, 255))
    canvas.paste(im, (1, 1))
    for pt in [(0, 0), (w + 1, 0), (0, h + 1), (w + 1, h + 1)]:
        try:
            ImageDraw.floodfill(canvas, pt, (255, 0, 255), thresh=36)
        except Exception:
            pass
    arr = np.array(canvas).astype(int)[1:-1, 1:-1]
    mask_fundo = np.abs(arr - np.array([255, 0, 255])).sum(axis=-1) < 30
    alpha = Image.fromarray(np.where(mask_fundo, 0, 255).astype(np.uint8))
    alpha = alpha.filter(ImageFilter.GaussianBlur(0.6))
    rgba = im.convert("RGBA")
    rgba.putalpha(alpha)
    bb = rgba.getbbox()
    return rgba.crop(bb) if bb else rgba


def gerar_icone(origem: Path, destino: Path, lado_final: int = 190) -> None:
    out = recortar_fundo(Image.open(origem))
    lado = max(out.size)
    canvas = Image.new("RGBA", (lado, lado), (0, 0, 0, 0))
    canvas.paste(out, ((lado - out.width) // 2, (lado - out.height) // 2), out)
    canvas.thumbnail((lado_final, lado_final), Image.LANCZOS)
    destino.parent.mkdir(parents=True, exist_ok=True)
    canvas.quantize(colors=64, method=Image.FASTOCTREE).save(destino, optimize=True)
