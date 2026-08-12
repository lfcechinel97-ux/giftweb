"""Multiplicador de preço - mesma tabela escalonada usada em
supabase/functions/product-feed/index.ts (calcDisplayPrice), para manter
consistência entre o feed do Google e o feed do Meta/WhatsApp."""
from __future__ import annotations

_TIERS = (
    (1, 6.0),
    (3, 4.8),
    (8, 3.8),
    (15, 3.0),
    (25, 2.5),
    (40, 2.1),
    (70, 1.8),
)
_DEFAULT_MULTIPLIER = 1.6
_DESCONTO = 0.16


def calcular_preco_exibicao(preco_custo: float) -> float:
    multiplicador = _DEFAULT_MULTIPLIER
    for teto, mult in _TIERS:
        if preco_custo <= teto:
            multiplicador = mult
            break
    valor = preco_custo * multiplicador * (1 - _DESCONTO)
    return round(valor, 2)
