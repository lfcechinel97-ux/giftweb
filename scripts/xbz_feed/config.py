"""Configuração e caminhos do pipeline de catálogo Meta (XBZ -> WhatsApp)."""
from __future__ import annotations

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

for _stream in (sys.stdout, sys.stderr):
    if hasattr(_stream, "reconfigure"):
        _stream.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env")
load_dotenv(ROOT / ".env.local", override=True)  # secrets locais, nunca commitados

SUPABASE_URL = os.environ["VITE_SUPABASE_URL"].rstrip("/")
SUPABASE_ANON_KEY = os.environ["VITE_SUPABASE_PUBLISHABLE_KEY"]
# Necessária apenas para criar o bucket catalogo-meta e subir imagens novas.
# Não existe no .env do projeto (é um secret de servidor) - precisa ser
# fornecida via variável de ambiente na hora de rodar o script.
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip() or None
# Alternativa ao service role key direto: chama a Edge Function upload-catalog-image,
# que roda dentro do Lovable Cloud e já tem acesso à service role key internamente.
CATALOG_UPLOAD_SECRET = os.environ.get("CATALOG_UPLOAD_SECRET", "").strip() or None

DATA_DIR = ROOT / "data"
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"
OUTPUT_DIR = ROOT / "output"
INPUT_CODES_FILE = DATA_DIR / "produtos_p_catalogo_whats.txt"
MANIFEST_FILE = DATA_DIR / "image_upload_manifest.json"

for d in (RAW_DIR, PROCESSED_DIR, OUTPUT_DIR):
    d.mkdir(parents=True, exist_ok=True)

STORAGE_BUCKET = "catalogo-meta"
SITE_LINK_BASE = "https://giftwebbrindes.com.br"
BRAND = "Gift Web"

# Codigos que existem na API/cache mas nao foram encontrados em topprodutos_curadoria
# na Fase 0 (confirmados via consulta real em 2026-08-12).
CODIGOS_NAO_CURADOS = {"08103", "14728P", "18505"}

# Correcao de grafia conhecida (Fase 0): o arquivo de entrada traz "9139i" mas
# o codigo real na base XBZ e "9139I" (I maiusculo, sem zero a esquerda).
NORMALIZACOES_CONHECIDAS = {"9139i": "9139I"}

REQUEST_TIMEOUT = 20
MAX_REQ_PER_SEC = 2.0
