"""Fase 1 — Coleta: consulta products_cache + topprodutos_curadoria para cada código
e salva o JSON bruto em data/raw/<codigo>.json para auditoria."""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone

from . import config
from .codes import CodigoEntrada, carregar_codigos
from .supabase_client import SupabaseREST

_PRODUCTS_CACHE_FIELDS = (
    "id,codigo_amigavel,codigo_prefixo,slug,nome,descricao,image_url,image_urls,"
    "has_image,site_link,cor,categoria,marca,preco_custo,estoque,peso,altura,"
    "largura,profundidade,ativo,is_variante,produto_pai"
)

_STORAGE_PATH_RE = re.compile(r"/topprodutos/([A-Za-z0-9]+)/")


def _curada_codigos(row: dict) -> set[str]:
    """Extrai os códigos XBZ referenciados por uma linha de topprodutos_curadoria
    (não existe coluna direta - o vínculo está em cores[].referencia e no path
    das URLs de imagem, ex: .../topprodutos/08331/...)."""
    achados: set[str] = set()
    urls = [row.get("imagem_principal"), *(row.get("galeria") or [])]
    for u in urls:
        if not u:
            continue
        m = _STORAGE_PATH_RE.search(u)
        if m:
            achados.add(m.group(1).upper())
    for c in row.get("cores") or []:
        ref = c.get("referencia")
        if ref:
            achados.add(ref.split("-")[0].upper())
    return achados


def carregar_curadoria_lookup(client: SupabaseREST) -> dict[str, dict]:
    """Busca toda a tabela topprodutos_curadoria (58 linhas - barato) e monta um
    índice código -> linha curada."""
    print("[COLLECT] Buscando topprodutos_curadoria (tabela inteira)...")
    rows = client.select("topprodutos_curadoria", {"select": "*"})
    lookup: dict[str, dict] = {}
    for row in rows:
        for codigo in _curada_codigos(row):
            if codigo in lookup:
                print(f"[COLLECT] AVISO: código '{codigo}' casa com mais de uma linha em "
                      f"topprodutos_curadoria ('{lookup[codigo]['nome']}' e '{row['nome']}'); mantendo a primeira")
                continue
            lookup[codigo] = row
    print(f"[COLLECT] topprodutos_curadoria: {len(rows)} linhas, {len(lookup)} códigos indexados")
    return lookup


def coletar_codigo(client: SupabaseREST, entrada: CodigoEntrada, curadoria_lookup: dict[str, dict]) -> dict:
    print(f"[COLLECT] {entrada.original}: consultando products_cache (codigo_prefixo={entrada.consulta})...")
    variantes = client.select(
        "products_cache",
        {"select": _PRODUCTS_CACHE_FIELDS, "codigo_prefixo": f"eq.{entrada.consulta}"},
    )
    curada = curadoria_lookup.get(entrada.consulta.upper())

    registro = {
        "codigo_entrada": entrada.original,
        "codigo_consulta": entrada.consulta,
        "coletado_em": datetime.now(timezone.utc).isoformat(),
        "products_cache_variantes": variantes,
        "topprodutos_curadoria": curada,
        "encontrado_api": len(variantes) > 0,
        "encontrado_curadoria": curada is not None,
    }

    status = []
    status.append(f"{len(variantes)} variante(s) na API" if variantes else "NÃO encontrado na API")
    status.append("curado" if curada else "sem curadoria")
    print(f"[COLLECT] {entrada.original}: {', '.join(status)}")

    raw_path = config.RAW_DIR / f"{entrada.original}.json"
    with open(raw_path, "w", encoding="utf-8") as f:
        json.dump(registro, f, ensure_ascii=False, indent=2)

    return registro


def coletar_todos() -> list[dict]:
    codigos = carregar_codigos()
    print(f"[COLLECT] {len(codigos)} códigos carregados de {config.INPUT_CODES_FILE.name}")
    client = SupabaseREST()
    curadoria_lookup = carregar_curadoria_lookup(client)

    registros = []
    for entrada in codigos:
        registros.append(coletar_codigo(client, entrada, curadoria_lookup))
    return registros


if __name__ == "__main__":
    coletar_todos()
