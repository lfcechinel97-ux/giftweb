"""Sobe todas as imagens pendentes (baixadas/normalizadas localmente, mas ainda
sem URL pública) usando a Edge Function upload-catalog-image, com o mesmo
versionamento idempotente (v1/v2/...) do resto do pipeline."""
from __future__ import annotations

import json

from . import config
from .upload_via_function import ensure_bucket, upload_bytes

MANIFEST_FILE = config.MANIFEST_FILE
STATUS_FILES = {
    "capa": config.DATA_DIR / "catalog_capa_status.json",
    "additional": config.DATA_DIR / "catalog_additional_status.json",
}
SEM_SKU_FILE = config.DATA_DIR / "sem_sku_imagens.json"


def _carregar_manifest() -> dict:
    if MANIFEST_FILE.exists():
        return json.loads(MANIFEST_FILE.read_text(encoding="utf-8"))
    return {}


def _salvar_manifest(manifest: dict) -> None:
    MANIFEST_FILE.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")


def _subir_um(codigo: str, slot: int, local_path: str, sha256: str, manifest: dict) -> str:
    chave = f"{codigo}-{slot}"
    entrada = manifest.get(chave)
    if entrada and entrada["sha256"] == sha256:
        print(f"[REUPLOAD] {chave}: já enviado antes (mesmo conteúdo), reaproveitando v{entrada['versao']}")
        return entrada["url"]

    versao = (entrada["versao"] + 1) if entrada else 1
    nome_arquivo = f"{codigo}-{slot}-v{versao}.jpg"
    with open(local_path, "rb") as f:
        dados = f.read()
    print(f"[REUPLOAD] {chave}: enviando {nome_arquivo}...")
    url = upload_bytes(nome_arquivo, dados)
    manifest[chave] = {"versao": versao, "sha256": sha256, "arquivo": nome_arquivo, "url": url}
    _salvar_manifest(manifest)
    print(f"[REUPLOAD] {chave}: OK -> {url}")
    return url


def subir_pendentes_catalogo() -> dict[str, int]:
    ensure_bucket()
    manifest = _carregar_manifest()
    contagem = {"capa": 0, "additional": 0, "sem_sku": 0, "erros": 0}

    for tipo, path in STATUS_FILES.items():
        slot = 1 if tipo == "capa" else 2
        status = json.loads(path.read_text(encoding="utf-8"))
        alterado = False
        for codigo, entrada in status.items():
            if entrada.get("url") or not entrada.get("local_path"):
                continue
            try:
                url = _subir_um(codigo, slot, entrada["local_path"], entrada["sha256"], manifest)
                entrada["url"] = url
                entrada["upload_pendente"] = False
                alterado = True
                contagem[tipo] += 1
            except Exception as exc:
                print(f"[REUPLOAD] ERRO em {codigo} slot {slot}: {exc}")
                contagem["erros"] += 1
        if alterado:
            path.write_text(json.dumps(status, ensure_ascii=False, indent=2), encoding="utf-8")

    if SEM_SKU_FILE.exists():
        sem_sku = json.loads(SEM_SKU_FILE.read_text(encoding="utf-8"))
        alterado = False
        for codigo, entrada in sem_sku.items():
            for slot_nome, slot_num in (("slot1", 1), ("slot2", 2)):
                s = entrada.get(slot_nome)
                if not s or s.get("url") or not s.get("local_path"):
                    continue
                try:
                    url = _subir_um(codigo, slot_num, s["local_path"], s["sha256"], manifest)
                    s["url"] = url
                    alterado = True
                    contagem["sem_sku"] += 1
                except Exception as exc:
                    print(f"[REUPLOAD] ERRO em {codigo} {slot_nome}: {exc}")
                    contagem["erros"] += 1
        if alterado:
            SEM_SKU_FILE.write_text(json.dumps(sem_sku, ensure_ascii=False, indent=2), encoding="utf-8")

    return contagem


if __name__ == "__main__":
    print(subir_pendentes_catalogo())
