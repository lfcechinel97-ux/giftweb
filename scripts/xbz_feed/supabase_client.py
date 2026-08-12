"""Cliente REST mínimo para Supabase (PostgREST + Storage), com rate limit e retry."""
from __future__ import annotations

import threading
import time

import requests

from . import config

_lock = threading.Lock()
_last_request_ts = 0.0


def _throttle() -> None:
    """Garante no máximo config.MAX_REQ_PER_SEC requisições por segundo (thread-safe)."""
    global _last_request_ts
    min_interval = 1.0 / config.MAX_REQ_PER_SEC
    with _lock:
        now = time.monotonic()
        wait = _last_request_ts + min_interval - now
        if wait > 0:
            time.sleep(wait)
        _last_request_ts = time.monotonic()


def _request_with_retry(method: str, url: str, *, max_retries: int = 5, **kwargs) -> requests.Response:
    kwargs.setdefault("timeout", config.REQUEST_TIMEOUT)
    last_exc: Exception | None = None
    for attempt in range(max_retries):
        _throttle()
        try:
            resp = requests.request(method, url, **kwargs)
        except (requests.ConnectionError, requests.Timeout) as exc:
            last_exc = exc
            backoff = min(2 ** attempt, 30)
            print(f"[HTTP] erro de rede em {url} (tentativa {attempt + 1}/{max_retries}): {exc}. Aguardando {backoff}s...")
            time.sleep(backoff)
            continue
        if resp.status_code == 429 or resp.status_code >= 500:
            backoff = min(2 ** attempt, 30)
            print(f"[HTTP] status {resp.status_code} em {url} (tentativa {attempt + 1}/{max_retries}). Aguardando {backoff}s...")
            time.sleep(backoff)
            continue
        return resp
    if last_exc:
        raise last_exc
    return resp  # type: ignore[possibly-undefined]


class SupabaseREST:
    def __init__(self, use_service_role: bool = False):
        key = config.SUPABASE_SERVICE_ROLE_KEY if use_service_role else config.SUPABASE_ANON_KEY
        if use_service_role and not key:
            raise RuntimeError(
                "SUPABASE_SERVICE_ROLE_KEY não configurada. Defina essa variável de ambiente "
                "para operações de escrita no Storage (criação de bucket / upload)."
            )
        self.key = key
        self.headers = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
        }

    # ---- PostgREST ----
    def select(self, table: str, params: dict) -> list[dict]:
        url = f"{config.SUPABASE_URL}/rest/v1/{table}"
        resp = _request_with_retry("GET", url, headers=self.headers, params=params)
        if resp.status_code >= 400:
            raise RuntimeError(f"Erro consultando {table}: {resp.status_code} {resp.text[:300]}")
        return resp.json()

    # ---- Storage ----
    def storage_head(self, bucket: str, path: str) -> requests.Response:
        url = f"{config.SUPABASE_URL}/storage/v1/object/public/{bucket}/{path}"
        return _request_with_retry("HEAD", url, allow_redirects=False)

    def storage_list(self, bucket: str, prefix: str = "") -> list[dict]:
        url = f"{config.SUPABASE_URL}/storage/v1/object/list/{bucket}"
        resp = _request_with_retry(
            "POST", url, headers={**self.headers, "Content-Type": "application/json"},
            json={"prefix": prefix, "limit": 1000, "offset": 0},
        )
        if resp.status_code >= 400:
            raise RuntimeError(f"Erro listando storage {bucket}/{prefix}: {resp.status_code} {resp.text[:300]}")
        return resp.json()

    def storage_upload(self, bucket: str, path: str, data: bytes, content_type: str, upsert: bool = False) -> None:
        url = f"{config.SUPABASE_URL}/storage/v1/object/{bucket}/{path}"
        headers = {
            **self.headers,
            "Content-Type": content_type,
            "x-upsert": "true" if upsert else "false",
        }
        resp = _request_with_retry("POST", url, headers=headers, data=data)
        if resp.status_code >= 400:
            raise RuntimeError(f"Erro fazendo upload de {bucket}/{path}: {resp.status_code} {resp.text[:300]}")

    def ensure_bucket(self, bucket: str, public: bool = True) -> None:
        url = f"{config.SUPABASE_URL}/storage/v1/bucket"
        resp = _request_with_retry(
            "POST", url, headers={**self.headers, "Content-Type": "application/json"},
            json={"id": bucket, "name": bucket, "public": public},
        )
        if resp.status_code >= 400 and "already exists" not in resp.text.lower() and "duplicate" not in resp.text.lower():
            raise RuntimeError(f"Erro criando bucket {bucket}: {resp.status_code} {resp.text[:300]}")


def public_storage_url(bucket: str, path: str) -> str:
    return f"{config.SUPABASE_URL}/storage/v1/object/public/{bucket}/{path}"
