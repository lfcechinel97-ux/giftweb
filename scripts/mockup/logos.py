"""Logos FICTICIAS para mockup de personalizacao.

Nomes inventados, com cara de empresa brasileira real, justamente para NAO
usar marca de terceiro num material comercial (isso implicaria falsamente
que a empresa e cliente da Gift Web - risco de uso indevido de marca).
"""
from __future__ import annotations

from dataclasses import dataclass

WIN_FONTS = "C:/Windows/Fonts/"


@dataclass
class Marca:
    nome: str
    cor: tuple[int, int, int]
    fonte: str
    marcador: str = "none"  # none | dot | square | bar | circle
    espacamento: int = 0
    caixa_alta: bool = True


MARCAS: list[Marca] = [
    Marca("VERTICE", (12, 58, 110), "arialbd.ttf", "square", 3),
    Marca("NOVARA", (176, 32, 44), "arialbd.ttf", "dot", 4),
    Marca("CAFE SERRANO", (86, 52, 28), "georgiab.ttf", "circle", 1),
    Marca("TECNOVA", (18, 122, 168), "arialbd.ttf", "bar", 2),
    Marca("GRUPO ALVORADA", (196, 122, 18), "arialbd.ttf", "dot", 1),
    Marca("VITALIS", (22, 128, 84), "arialbd.ttf", "circle", 3),
    Marca("MERIDIANO", (38, 42, 56), "georgiab.ttf", "bar", 2),
    Marca("SOLARIS", (214, 92, 20), "arialbd.ttf", "dot", 3),
    Marca("CONSTRUFORTE", (24, 46, 84), "impact.ttf", "square", 0),
    Marca("AGROVALE", (58, 112, 32), "arialbd.ttf", "square", 2),
    Marca("LOGISUL", (10, 84, 140), "arialbd.ttf", "bar", 2),
    Marca("PRIMA SAUDE", (0, 122, 130), "arialbd.ttf", "circle", 2),
]
