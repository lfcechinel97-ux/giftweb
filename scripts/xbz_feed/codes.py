"""Leitura e normalização da lista de códigos de entrada."""
from __future__ import annotations

from dataclasses import dataclass

from . import config


@dataclass
class CodigoEntrada:
    original: str  # exatamente como veio no arquivo (vai pro campo "id" do CSV)
    consulta: str  # grafia usada para consultar o banco (pode diferir do original)


def carregar_codigos() -> list[CodigoEntrada]:
    if not config.INPUT_CODES_FILE.exists():
        raise FileNotFoundError(f"Arquivo de entrada não encontrado: {config.INPUT_CODES_FILE}")

    codigos: list[CodigoEntrada] = []
    vistos: set[str] = set()
    with open(config.INPUT_CODES_FILE, encoding="utf-8") as f:
        for linha_num, linha in enumerate(f, start=1):
            linha = linha.strip()
            if not linha or linha.startswith("#"):
                continue
            original = linha
            consulta = config.NORMALIZACOES_CONHECIDAS.get(original, original)
            if consulta != original:
                print(f"[CODES] linha {linha_num}: '{original}' normalizado para '{consulta}' (grafia real na base XBZ)")
            if original in vistos:
                print(f"[CODES] AVISO: código '{original}' duplicado no arquivo de entrada (linha {linha_num}), ignorando repetição")
                continue
            vistos.add(original)
            codigos.append(CodigoEntrada(original=original, consulta=consulta))
    return codigos
