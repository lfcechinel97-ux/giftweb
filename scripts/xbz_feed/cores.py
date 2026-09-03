"""Cores dos produtos para as bolinhas do catalogo.

O mapa espelha src/utils/colorHex.ts para o catalogo usar exatamente as mesmas
cores que o site ja usa nas fichas de produto.
"""
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

MAPA = {
    "azul": "#3B82F6", "azul claro": "#60A5FA", "azul royal": "#1D4ED8",
    "azul escuro": "#1E3A5F", "azul marinho": "#1E3A5F",
    "vermelho": "#EF4444", "verde": "#22C55E", "verde claro": "#4ADE80",
    "verde escuro": "#166534", "verde bandeira": "#15803D", "verde limao": "#84CC16",
    "verde militar": "#4B5320", "verde musgo": "#4A5D23",
    "preto": "#111827", "branco": "#F9FAFB", "branco perola": "#F3EFE7",
    "off white": "#F5F5EF", "bege": "#E8D9BE", "creme": "#F2E8D5",
    "amarelo": "#EAB308", "roxo": "#8B5CF6", "lilas": "#C4B5FD",
    "rosa": "#EC4899", "rosa claro": "#F9A8D4", "rosa escuro": "#BE185D",
    "pink": "#DB2777", "cinza": "#6B7280", "cinza claro": "#9CA3AF",
    "cinza escuro": "#374151", "chumbo": "#4B5563", "laranja": "#F97316",
    "marrom": "#92400E", "dourado": "#D4A15A", "ouro": "#D4A15A",
    "prata": "#C0C0C0", "prateado": "#C0C0C0", "cromado": "#CBD0D6",
    "inox": "#B8BCC4", "vinho": "#7F1D1D", "bordo": "#6B0F1A",
    "grafite": "#374151", "natural": "#D9C79E", "transparente": "#E5E7EB",
    "cristal": "#E5E7EB", "fume": "#9BA3AB", "turquesa": "#14B8A6",
    "champagne": "#E3D3B0", "cobre": "#B87333", "kraft": "#C8A87C",
    "madeira": "#B98B57", "bambu": "#C9A26B",
}
PADRAO = "#94A3B8"


def _norm(cor: str) -> str:
    n = unicodedata.normalize("NFD", cor.strip().lower())
    n = "".join(c for c in n if not unicodedata.combining(c))
    # "AZUL 1", "BRANCO 2" sao a mesma cor com codigo de fornecedor diferente
    n = re.sub(r"\s+\d+$", "", n)
    return re.sub(r"\s+", " ", n).strip()


def hex_da_cor(cor: str) -> str | list[str]:
    """Retorna o hex da cor. Cor composta ('PRETO COM PRATA') volta como lista
    de 2 hex, para a bolinha ser desenhada em degrade."""
    n = _norm(cor)
    if " com " in n:
        partes = [p.strip() for p in n.split(" com ")]
        hexes = [_hex_simples(p) for p in partes]
        return hexes if hexes[0] != hexes[1] else hexes[0]
    return _hex_simples(n)


def _hex_simples(n: str) -> str:
    if n in MAPA:
        return MAPA[n]
    for chave in sorted(MAPA, key=len, reverse=True):
        if chave in n:
            return MAPA[chave]
    for chave in sorted(MAPA, key=len, reverse=True):
        if n and n in chave:
            return MAPA[chave]
    return PADRAO


def cores_do_produto(raw_path: Path) -> list[dict]:
    """Extrai as cores de um produto do JSON bruto. Prioriza as cores curadas
    (topprodutos_curadoria) e cai para as variantes da API. Deduplica ignorando
    caixa e sufixo numerico, preservando a ordem."""
    if not raw_path.exists():
        return []
    d = json.loads(raw_path.read_text(encoding="utf-8"))

    brutas: list[str] = []
    curada = d.get("topprodutos_curadoria")
    if curada and curada.get("cores"):
        brutas = [c["nome"] for c in curada["cores"] if c.get("nome")]
    if not brutas:
        for v in d.get("products_cache_variantes", []):
            if v.get("cor"):
                brutas.append(v["cor"])

    vistas, cores = set(), []
    for bruta in brutas:
        chave = _norm(bruta)
        if not chave or chave in vistas:
            continue
        vistas.add(chave)
        cores.append({"n": chave.title(), "h": hex_da_cor(bruta)})
    return cores
