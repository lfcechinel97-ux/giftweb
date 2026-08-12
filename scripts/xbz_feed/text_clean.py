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
_MULTISPACE_RE = re.compile(r"[ \t]+")
_MULTIBLANK_RE = re.compile(r"\n{3,}")


def limpar_texto(texto: str) -> str:
    if not texto:
        return ""
    t = _HTML_TAG_RE.sub(" ", texto)
    t = _EMOJI_RE.sub("", t)
    t = _MULTISPACE_RE.sub(" ", t)
    t = _MULTIBLANK_RE.sub("\n\n", t)
    return t.strip()
