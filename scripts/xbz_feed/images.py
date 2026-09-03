"""Fase 2 — Imagens.

Cenário A (40 códigos curados): imagem já está no Supabase Storage -> só validação HEAD.
Cenário B (3 códigos sem curadoria): baixa do CDN XBZ, classifica, normaliza (Pillow,
1024x1024 fundo branco) e prepara upload para o bucket catalogo-meta.
"""
from __future__ import annotations

import hashlib
import io
import json
import re
from dataclasses import dataclass, field

import numpy as np
import requests
from PIL import Image, ImageFilter

from . import config
from .resolve import ImagemCandidata
from .supabase_client import SupabaseREST, public_storage_url

BROWSER_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)

_XBZ_DIR_RE = re.compile(r"(/img/produtos/)(\d+)(/)")
_DIR_FALLBACK_ORDER = ["3", "2", "1"]  # 3 = 1000x1000 (maior confirmada na Fase 0), depois menor
MIN_LADO_PX = 500

LOGO_PATH = config.ROOT / "public" / "logos" / "giftweb-logo.png"
LOGO_ESCALA = 0.16  # logo ocupa ~16% da largura do canvas
LOGO_MARGEM = 0.03  # 3% de margem da borda

MANIFEST: dict = {}
if config.MANIFEST_FILE.exists():
    MANIFEST = json.loads(config.MANIFEST_FILE.read_text(encoding="utf-8"))


def _salvar_manifest() -> None:
    config.MANIFEST_FILE.write_text(json.dumps(MANIFEST, ensure_ascii=False, indent=2), encoding="utf-8")


@dataclass
class ImagemProcessada:
    codigo: str
    slot: int  # 1 = principal, 2 = adicional
    ok: bool
    motivo_reprovacao: str | None = None
    watermark_suspeito: bool = False
    watermark_detalhe: dict = field(default_factory=dict)
    largura_original: int | None = None
    altura_original: int | None = None
    local_path: str | None = None
    sha256: str | None = None
    url_final: str | None = None
    fonte_url: str | None = None


def _head(url: str, max_retries: int = 4) -> requests.Response:
    import time
    last_exc = None
    for tentativa in range(max_retries):
        try:
            resp = requests.head(url, headers={"User-Agent": BROWSER_UA}, timeout=config.REQUEST_TIMEOUT, allow_redirects=False)
        except requests.RequestException as exc:
            last_exc = exc
            time.sleep(min(2 ** tentativa, 10))
            continue
        if resp.status_code == 429:
            time.sleep(min(2 ** tentativa, 10))
            continue
        return resp
    if last_exc:
        raise last_exc
    return resp


def validar_url_existente(url: str) -> dict:
    """Valida uma URL de imagem já hospedada (cenário A): 200, sem redirect, content-type de imagem."""
    try:
        resp = _head(url)
    except requests.RequestException as exc:
        return {"ok": False, "status": None, "erro": str(exc)}
    ok = resp.status_code == 200 and "image/" in resp.headers.get("content-type", "")
    return {
        "ok": ok,
        "status": resp.status_code,
        "content_type": resp.headers.get("content-type"),
        "redirect": resp.status_code in (301, 302, 303, 307, 308),
    }


def _baixar_com_fallback_diretorio(url: str) -> tuple[bytes, str]:
    """Baixa uma imagem do CDN XBZ. Se a URL tiver o padrão /img/produtos/<N>/,
    tenta na ordem 3 -> 2 -> 1 em caso de 404/500 (fallback de resolução/link morto)."""
    m = _XBZ_DIR_RE.search(url)
    tentativas = [url]
    if m:
        outros = [d for d in _DIR_FALLBACK_ORDER if d != m.group(2)]
        tentativas = [url] + [_XBZ_DIR_RE.sub(rf"\g<1>{d}\g<3>", url) for d in outros]

    ultimo_erro = None
    for tentativa_url in tentativas:
        try:
            resp = requests.get(tentativa_url, headers={"User-Agent": BROWSER_UA}, timeout=config.REQUEST_TIMEOUT)
        except (requests.ConnectionError, requests.Timeout) as exc:
            ultimo_erro = str(exc)
            continue
        if resp.status_code == 200 and resp.content:
            return resp.content, tentativa_url
        ultimo_erro = f"HTTP {resp.status_code}"
    raise RuntimeError(f"Falha ao baixar {url} (e variações de diretório): {ultimo_erro}")


def _classificar_watermark(img: Image.Image) -> tuple[bool, dict]:
    """Heurística grosseira: região com baixa variância de pixel (fundo liso) mas com
    bordas nítidas dentro dela (arestas de um selo/logo) = suspeita. Sujeita a erro -
    é só um sinalizador para revisão humana (Fase 2.5)."""
    gray = img.convert("L")
    edges = gray.filter(ImageFilter.FIND_EDGES)
    arr = np.asarray(gray, dtype=np.float64)
    earr = np.asarray(edges, dtype=np.float64)
    h, w = arr.shape
    rh, rw = max(1, int(h * 0.18)), max(1, int(w * 0.18))
    regioes = {
        "sup_esq": (0, rh, 0, rw),
        "sup_dir": (0, rh, w - rw, w),
        "inf_esq": (h - rh, h, 0, rw),
        "inf_dir": (h - rh, h, w - rw, w),
        "inf_centro": (h - rh, h, max(0, w // 2 - rw // 2), min(w, w // 2 + rw // 2)),
    }
    detalhe = {}
    suspeitas = []
    for nome, (y0, y1, x0, x1) in regioes.items():
        std = float(arr[y0:y1, x0:x1].std())
        edge_mean = float(earr[y0:y1, x0:x1].mean())
        detalhe[nome] = {"std": round(std, 1), "edge_mean": round(edge_mean, 1)}
        if std < 18 and edge_mean > 8:
            suspeitas.append(nome)
    return bool(suspeitas), {"regioes": detalhe, "regioes_suspeitas": suspeitas}


def _normalizar_para_canvas(img: Image.Image, tamanho: int = 1024, margem_pct: float = 0.05) -> Image.Image:
    img = img.convert("RGB")
    max_lado = int(tamanho * (1 - 2 * margem_pct))
    escala = min(max_lado / img.width, max_lado / img.height)
    novo_w, novo_h = max(1, round(img.width * escala)), max(1, round(img.height * escala))
    img_redim = img.resize((novo_w, novo_h), Image.LANCZOS)
    canvas = Image.new("RGB", (tamanho, tamanho), (255, 255, 255))
    offset = ((tamanho - novo_w) // 2, (tamanho - novo_h) // 2)
    canvas.paste(img_redim, offset)
    return canvas


def _aplicar_logo(canvas: Image.Image) -> Image.Image:
    """Cola a logo Gift Web (public/logos/giftweb-logo.png) no canto inferior direito,
    respeitando a transparência do PNG."""
    if not LOGO_PATH.exists():
        raise FileNotFoundError(f"Logo não encontrada em {LOGO_PATH}")
    logo = Image.open(LOGO_PATH).convert("RGBA")
    tamanho_canvas = canvas.size[0]
    largura_logo = round(tamanho_canvas * LOGO_ESCALA)
    escala = largura_logo / logo.width
    logo_redim = logo.resize((largura_logo, round(logo.height * escala)), Image.LANCZOS)
    margem_px = round(tamanho_canvas * LOGO_MARGEM)
    pos = (tamanho_canvas - logo_redim.width - margem_px, tamanho_canvas - logo_redim.height - margem_px)
    resultado = canvas.convert("RGBA")
    resultado.alpha_composite(logo_redim, dest=pos)
    return resultado.convert("RGB")


def processar_imagem_local(codigo: str, slot: int, caminho_local: str, aplicar_logo: bool = False) -> ImagemProcessada:
    """Processa uma imagem já em disco (fornecida pelo usuário, não baixada da XBZ):
    mesma classificação/normalização de processar_imagem_nao_curada, com opção de
    marca d'água da logo Gift Web."""
    print(f"[IMAGES] {codigo}: processando imagem local slot {slot} de {caminho_local}")
    with open(caminho_local, "rb") as f:
        conteudo = f.read()

    img = Image.open(io.BytesIO(conteudo))
    largura, altura = img.size
    menor_lado = min(largura, altura)
    print(f"[IMAGES] {codigo}: {largura}x{altura}")

    if menor_lado < MIN_LADO_PX:
        print(f"[IMAGES] {codigo}: REPROVADA_TAMANHO (menor lado {menor_lado}px < {MIN_LADO_PX}px)")
        return ImagemProcessada(
            codigo=codigo, slot=slot, ok=False,
            motivo_reprovacao=f"REPROVADA_TAMANHO: menor lado {menor_lado}px < {MIN_LADO_PX}px",
            largura_original=largura, altura_original=altura, fonte_url=caminho_local,
        )

    suspeita, detalhe = _classificar_watermark(img)

    canvas = _normalizar_para_canvas(img)
    if aplicar_logo:
        canvas = _aplicar_logo(canvas)

    buf = io.BytesIO()
    canvas.save(buf, format="JPEG", quality=85)
    dados_finais = buf.getvalue()
    if len(dados_finais) / (1024 * 1024) >= 8:
        for q in (75, 65, 55):
            buf = io.BytesIO()
            canvas.save(buf, format="JPEG", quality=q)
            dados_finais = buf.getvalue()
            if len(dados_finais) / (1024 * 1024) < 8:
                break

    local_path = config.PROCESSED_DIR / f"{codigo}-{slot}.jpg"
    local_path.write_bytes(dados_finais)
    sha = hashlib.sha256(dados_finais).hexdigest()
    print(f"[IMAGES] {codigo}: normalizada{'​+logo' if aplicar_logo else ''} -> {local_path.name} "
          f"({len(dados_finais)/1024:.0f} KB, sha256={sha[:12]}...)")

    return ImagemProcessada(
        codigo=codigo, slot=slot, ok=True,
        watermark_suspeito=suspeita, watermark_detalhe=detalhe,
        largura_original=largura, altura_original=altura,
        local_path=str(local_path), sha256=sha, fonte_url=caminho_local,
    )


def processar_imagem_nao_curada(codigo: str, slot: int, candidata: ImagemCandidata) -> ImagemProcessada:
    print(f"[IMAGES] {codigo}: baixando imagem slot {slot} de {candidata.url}")
    try:
        conteudo, url_usada = _baixar_com_fallback_diretorio(candidata.url)
    except RuntimeError as exc:
        print(f"[IMAGES] {codigo}: FALHA no download - {exc}")
        return ImagemProcessada(codigo=codigo, slot=slot, ok=False, motivo_reprovacao=f"download falhou: {exc}", fonte_url=candidata.url)

    img = Image.open(io.BytesIO(conteudo))
    largura, altura = img.size
    menor_lado = min(largura, altura)
    print(f"[IMAGES] {codigo}: baixado {largura}x{altura} de {url_usada}")

    if menor_lado < MIN_LADO_PX:
        print(f"[IMAGES] {codigo}: REPROVADA_TAMANHO (menor lado {menor_lado}px < {MIN_LADO_PX}px)")
        return ImagemProcessada(
            codigo=codigo, slot=slot, ok=False,
            motivo_reprovacao=f"REPROVADA_TAMANHO: menor lado {menor_lado}px < {MIN_LADO_PX}px",
            largura_original=largura, altura_original=altura, fonte_url=url_usada,
        )

    suspeita, detalhe = _classificar_watermark(img)
    if suspeita:
        print(f"[IMAGES] {codigo}: SUSPEITA_WATERMARK - {detalhe['regioes_suspeitas']}")

    canvas = _normalizar_para_canvas(img)
    buf = io.BytesIO()
    canvas.save(buf, format="JPEG", quality=85)
    dados_finais = buf.getvalue()
    tamanho_mb = len(dados_finais) / (1024 * 1024)
    if tamanho_mb >= 8:
        # reduz qualidade em degraus até caber, sem fazer upscale nem trocar resolução
        for q in (75, 65, 55):
            buf = io.BytesIO()
            canvas.save(buf, format="JPEG", quality=q)
            dados_finais = buf.getvalue()
            if len(dados_finais) / (1024 * 1024) < 8:
                break

    local_path = config.PROCESSED_DIR / f"{codigo}-{slot}.jpg"
    local_path.write_bytes(dados_finais)
    sha = hashlib.sha256(dados_finais).hexdigest()
    print(f"[IMAGES] {codigo}: normalizada -> {local_path.name} ({len(dados_finais)/1024:.0f} KB, sha256={sha[:12]}...)")

    return ImagemProcessada(
        codigo=codigo, slot=slot, ok=True,
        watermark_suspeito=suspeita, watermark_detalhe=detalhe,
        largura_original=largura, altura_original=altura,
        local_path=str(local_path), sha256=sha, fonte_url=url_usada,
    )


def _proxima_versao_disponivel(codigo: str, slot: int, sha256_novo: str) -> tuple[int, bool]:
    """Retorna (versao, ja_atualizado). Idempotência: se o conteúdo (hash) já é o mesmo
    da última versão registrada no manifest, reaproveita a mesma versão/URL (não sobe de novo)."""
    chave = f"{codigo}-{slot}"
    entrada = MANIFEST.get(chave)
    if entrada is None:
        return 1, False
    if entrada["sha256"] == sha256_novo:
        return entrada["versao"], True
    return entrada["versao"] + 1, False


def enviar_para_storage(processada: ImagemProcessada, service_client: SupabaseREST | None = None,
                         usar_edge_function: bool | None = None) -> str | None:
    """Sobe pro bucket catalogo-meta com versionamento idempotente (manifest por
    codigo-slot). Por padrão usa a Edge Function upload-catalog-image (único
    caminho que realmente funciona neste projeto - service_role key direta não
    está disponível). Passe service_client para o caminho antigo (direto)."""
    if not processada.ok or not processada.local_path:
        return None
    if usar_edge_function is None:
        usar_edge_function = service_client is None
    versao, ja_atualizado = _proxima_versao_disponivel(processada.codigo, processada.slot, processada.sha256)
    nome_arquivo = f"{processada.codigo}-{processada.slot}-v{versao}.jpg"

    if ja_atualizado:
        url = public_storage_url(config.STORAGE_BUCKET, nome_arquivo)
        print(f"[IMAGES] {processada.codigo}: conteúdo idêntico ao já enviado, reaproveitando {nome_arquivo}")
        processada.url_final = url
        return url

    dados = open(processada.local_path, "rb").read()
    print(f"[IMAGES] {processada.codigo}: enviando {nome_arquivo} para bucket {config.STORAGE_BUCKET}...")
    if usar_edge_function:
        from .upload_via_function import upload_bytes
        url = upload_bytes(nome_arquivo, dados, "image/jpeg")
    else:
        service_client.storage_upload(config.STORAGE_BUCKET, nome_arquivo, dados, "image/jpeg", upsert=False)
        url = public_storage_url(config.STORAGE_BUCKET, nome_arquivo)

    MANIFEST[f"{processada.codigo}-{processada.slot}"] = {
        "versao": versao, "sha256": processada.sha256, "arquivo": nome_arquivo, "url": url,
    }
    _salvar_manifest()
    processada.url_final = url
    print(f"[IMAGES] {processada.codigo}: OK -> {url}")
    return url
