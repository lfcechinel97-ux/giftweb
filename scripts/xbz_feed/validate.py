"""Fase 4 — Validação obrigatória antes de fechar o CSV."""
from __future__ import annotations

import re

from .images import validar_url_existente

CAMPOS_OBRIGATORIOS = ["id", "title", "description", "availability", "condition", "price", "link", "image_link", "brand"]
_PRECO_RE = re.compile(r"^\d+\.\d{2} BRL$")


def _titulo_e_caixa_alta(titulo: str) -> bool:
    letras = [c for c in titulo if c.isalpha()]
    return bool(letras) and titulo == titulo.upper()


def validar_linhas(linhas: list[dict]) -> tuple[list[dict], list[dict]]:
    """Retorna (linhas_validas, excluidos) onde excluidos é uma lista de
    {codigo, motivos: [...]}."""
    validas = []
    excluidos = []
    ids_vistos: dict[str, int] = {}

    for linha in linhas:
        motivos = []
        codigo = linha["id"]

        for campo in CAMPOS_OBRIGATORIOS:
            if not (linha.get(campo) or "").strip():
                motivos.append(f"campo obrigatório '{campo}' vazio")

        if codigo in ids_vistos:
            motivos.append(f"id duplicado (já usado na linha {ids_vistos[codigo]})")
        else:
            ids_vistos[codigo] = len(validas) + len(excluidos) + 1

        preco = linha.get("price", "")
        if preco and not _PRECO_RE.match(preco):
            motivos.append(f"price fora do formato 'N.NN BRL': {preco!r}")

        titulo = linha.get("title", "")
        if len(titulo) > 200:
            motivos.append(f"title com {len(titulo)} caracteres (> 200)")
        if titulo and _titulo_e_caixa_alta(titulo):
            motivos.append(f"title em CAIXA ALTA: {titulo!r}")

        if motivos:
            excluidos.append({"codigo": codigo, "motivos": motivos})
        else:
            validas.append(linha)

    return validas, excluidos


def validar_imagens_http(linhas: list[dict]) -> tuple[list[dict], list[dict]]:
    """Valida que image_link e additional_image_link (quando presente) respondem 200.
    Faz cache por URL pra não repetir HEAD em produtos que reaproveitam a mesma imagem."""
    validas = []
    excluidos = []
    cache: dict[str, bool] = {}

    def checar(url: str) -> bool:
        if url not in cache:
            r = validar_url_existente(url)
            cache[url] = r["ok"]
            if not r["ok"]:
                print(f"[VALIDATE] URL não respondeu 200: {url} (status={r.get('status')})")
        return cache[url]

    for linha in linhas:
        motivos = []
        if not checar(linha["image_link"]):
            motivos.append(f"image_link não respondeu 200: {linha['image_link']}")
        if linha.get("additional_image_link"):
            if not checar(linha["additional_image_link"]):
                motivos.append(f"additional_image_link não respondeu 200: {linha['additional_image_link']}")
        if motivos:
            excluidos.append({"codigo": linha["id"], "motivos": motivos})
        else:
            validas.append(linha)

    return validas, excluidos
