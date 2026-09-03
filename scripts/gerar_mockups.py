#!/usr/bin/env python
"""Gera as fotos personalizadas (logo ficticia + simulacao de gravacao) para o
catalogo HTML. Salva em data/mockups/<codigo>.jpg a 500px."""
from __future__ import annotations

import csv
import io
import os
import sys
from pathlib import Path

import requests
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from scripts.mockup.aplicar_logo import aplicar
from scripts.mockup.logos import MARCAS

RAIZ = Path(__file__).resolve().parent.parent
CSV_IN = RAIZ / "output" / "catalogo_html_produtos.csv"
DIR_OUT = RAIZ / "data" / "mockups"
DIR_OUT.mkdir(parents=True, exist_ok=True)
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

# Tecnica coerente com o material do produto
LASER = ("inox", "aluminio", "alumínio", "metal", "termica", "térmica", "chaveiro",
         "saca rolhas", "squeeze", "garrafa", "caneca", "copo")
DTF = ("mochila", "bolsa", "sacola", "necessaire", "sacochila", "mala", "bone", "boné", "toalha")
UV = ("caderno", "caderneta", "bloco", "agenda", "kit executivo", "porta", "mouse pad")


def escolher_tecnica(nome: str) -> str:
    n = nome.lower()
    for k in DTF:
        if k in n:
            return "dtf"
    for k in UV:
        if k in n:
            return "uv"
    for k in LASER:
        if k in n:
            return "laser"
    return "silk"


def carregar_foto(codigo: str, url: str) -> Image.Image | None:
    local = RAIZ / "data" / "processed" / f"{codigo}-1.jpg"
    if local.exists():
        return Image.open(local)
    if url:
        r = requests.get(url, headers={"User-Agent": UA}, timeout=30)
        if r.status_code == 200:
            return Image.open(io.BytesIO(r.content))
    return None


def main():
    with open(CSV_IN, encoding="utf-8-sig") as f:
        linhas = list(csv.DictReader(f))

    ok = falhou = 0
    for i, r in enumerate(linhas):
        cod = r["codigo"]
        destino = DIR_OUT / f"{cod}.jpg"
        if destino.exists():
            ok += 1
            continue
        foto = carregar_foto(cod, r["image_url"])
        if foto is None:
            print(f"[MOCKUP] {cod}: SEM FOTO - pulado")
            falhou += 1
            continue
        marca = MARCAS[i % len(MARCAS)]
        tecnica = escolher_tecnica(r["nome"])
        try:
            out = aplicar(foto, marca, tecnica)
        except Exception as exc:
            print(f"[MOCKUP] {cod}: ERRO ({exc}) - usando foto original")
            out = foto.convert("RGB")
            falhou += 1
        out = out.convert("RGB")
        out.thumbnail((500, 500), Image.LANCZOS)
        out.save(destino, quality=75, optimize=True, progressive=True)
        print(f"[MOCKUP] {cod}: {marca.nome} / {tecnica}")
        ok += 1

    print(f"[MOCKUP] DONE - {ok} gerados, {falhou} com problema")


if __name__ == "__main__":
    main()
