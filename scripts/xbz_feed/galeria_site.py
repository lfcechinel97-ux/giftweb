"""Galeria da pagina do produto no site do fornecedor.

products_cache guarda uma imagem por cor e mais nada. A foto coletiva - o
produto com todas as cores lado a lado, que e a que o catalogo usa como
segunda imagem - nao esta la: ela so aparece na galeria da pagina do produto
no site da XBZ, onde os arquivos extras levam sufixo dN sobre o id da imagem
principal (22788 -> 22788d1, 22788d2, ...). Como o timestamp faz parte do
nome, nao da para montar essas URLs por conta: precisa ler a pagina.

O HTML fica em cache no disco porque uma passada no catalogo inteiro sao ~100
paginas, e refazer isso a cada ajuste seria maltratar o site do fornecedor.
"""
from __future__ import annotations

import re
import time
from pathlib import Path

import requests

from . import config

CACHE = config.ROOT / "data" / "raw_site"
BASE_SITE = "https://www.xbzbrindes.com.br"
BASE_CDN = "https://cdn.xbzbrindes.com.br"
UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)
PAUSA = 0.8

_IMG_RE = re.compile(r'data-src="(/img/produtos/\d+/[^"]+\.(?:jpg|jpeg|png|webp))"', re.I)
# nome termina em "<id>d<n>-<timestamp>": as fotos extras da galeria
_DETALHE_RE = re.compile(r"-(\d+)d(\d+)-\d+\.(?:jpg|jpeg|png|webp)$", re.I)


def baixar_pagina(codigo: str, forcar: bool = False) -> str | None:
    CACHE.mkdir(parents=True, exist_ok=True)
    destino = CACHE / f"{codigo}.html"
    if destino.exists() and not forcar:
        return destino.read_text(encoding="utf-8", errors="replace")
    url = f"{BASE_SITE}/{codigo}"
    for tentativa in range(3):
        try:
            r = requests.get(url, headers={"User-Agent": UA}, timeout=30)
            if r.status_code == 404:
                print(f"[GALERIA] {codigo}: pagina 404")
                return None
            r.raise_for_status()
            destino.write_text(r.text, encoding="utf-8")
            time.sleep(PAUSA)
            return r.text
        except requests.RequestException as e:
            if tentativa == 2:
                print(f"[GALERIA] {codigo}: falhou ({e})")
                return None
            time.sleep(2 * (tentativa + 1))
    return None


def galeria(codigo: str, forcar: bool = False) -> list[str]:
    """URLs das fotos extras (dN) na ordem em que a pagina as lista.

    Fora essas, a pagina repete a foto principal e as fotos por cor - que ja
    vem do products_cache e nao interessam aqui.
    """
    html = baixar_pagina(codigo, forcar)
    if not html:
        return []
    vistos: set[str] = set()
    achados: list[tuple[int, str]] = []
    for caminho in _IMG_RE.findall(html):
        if caminho in vistos:
            continue
        vistos.add(caminho)
        m = _DETALHE_RE.search(caminho)
        if m:
            achados.append((int(m.group(2)), BASE_CDN + caminho))
    achados.sort(key=lambda t: t[0])
    return [u for _, u in achados]


def segunda_foto(codigo: str, forcar: bool = False) -> str | None:
    """A "segunda foto" da pagina do produto: primeira da galeria (d1)."""
    g = galeria(codigo, forcar)
    return g[0] if g else None
