"""Upload de imagens via a Edge Function upload-catalog-image, em vez de usar a
service_role key diretamente (que não é acessível fora do Lovable Cloud).
A função usa a service_role key internamente e só aceita chamadas com o
header x-upload-secret batendo o segredo CATALOG_UPLOAD_SECRET."""
from __future__ import annotations

import base64

import requests

from . import config

FUNCTION_URL = f"{config.SUPABASE_URL}/functions/v1/upload-catalog-image"


def _headers() -> dict:
    if not config.CATALOG_UPLOAD_SECRET:
        raise RuntimeError(
            "CATALOG_UPLOAD_SECRET não configurada. Defina essa variável de ambiente "
            "(mesmo valor cadastrado como secret 'CATALOG_UPLOAD_SECRET' no Lovable Cloud)."
        )
    return {
        "apikey": config.SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
        "x-upload-secret": config.CATALOG_UPLOAD_SECRET,
    }


def ensure_bucket() -> None:
    resp = requests.post(FUNCTION_URL, headers=_headers(), json={"action": "ensure_bucket"}, timeout=30)
    if resp.status_code >= 400:
        raise RuntimeError(f"ensure_bucket falhou: {resp.status_code} {resp.text[:300]}")


def upload_bytes(path: str, dados: bytes, content_type: str = "image/jpeg") -> str:
    payload = {
        "action": "upload",
        "path": path,
        "contentBase64": base64.b64encode(dados).decode("ascii"),
        "contentType": content_type,
    }
    resp = requests.post(FUNCTION_URL, headers=_headers(), json=payload, timeout=60)
    if resp.status_code >= 400:
        raise RuntimeError(f"upload de {path} falhou: {resp.status_code} {resp.text[:300]}")
    return resp.json()["url"]
