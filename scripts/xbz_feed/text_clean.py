"""Limpeza de texto para os campos description/title do feed (sem HTML, sem emoji)."""
from __future__ import annotations

import re

_HTML_TAG_RE = re.compile(r"<[^>]+>")
_EMOJI_RE = re.compile(
    "["
    "\U0001F300-\U0001FAFF"
    "\U00002600-\U000027BF"
    "\U0001F1E6-\U0001F1FF"
    "\U00002190-\U000021FF"
    "\U00002B00-\U00002BFF"
    "]+",
    flags=re.UNICODE,
)
_WHITESPACE_RE = re.compile(r"\s+")


def limpar_texto(texto: str) -> str:
    """Achata para uma única linha (sem \\r\\n) - o CSV vai para o Google Sheets via
    importação, e quebras de linha dentro de um campo quebram o parser de import
    do Sheets mesmo com o campo entre aspas (confirmado na prática em 2026-08-12:
    virou 3 linhas soltas por produto e desalinhou todas as colunas seguintes)."""
    if not texto:
        return ""
    t = _HTML_TAG_RE.sub(" ", texto)
    t = _EMOJI_RE.sub("", t)
    t = _WHITESPACE_RE.sub(" ", t)
    return t.strip()
