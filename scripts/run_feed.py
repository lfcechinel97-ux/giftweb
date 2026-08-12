#!/usr/bin/env python
"""Pipeline do catálogo Meta (XBZ -> WhatsApp). Idempotente: pode rodar de novo
a qualquer momento sem duplicar upload nem linha do CSV.

Uso:
    python scripts/run_feed.py collect     # Fase 1 - coleta (API + curadoria)
    python scripts/run_feed.py images      # Fase 2 - imagens (valida curadas, processa não-curadas)
    python scripts/run_feed.py review      # gera output/revisao_imagens.html
    python scripts/run_feed.py csv         # Fase 3 - gera output/feed_meta.csv
    python scripts/run_feed.py validate    # Fase 4 - valida + gera output/relatorio.md
    python scripts/run_feed.py all         # roda tudo em sequência
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scripts.xbz_feed import config
from scripts.xbz_feed.collect import coletar_todos
from scripts.xbz_feed.csv_builder import gerar_csv
from scripts.xbz_feed.images import (
    ImagemProcessada,
    enviar_para_storage,
    processar_imagem_nao_curada,
    validar_url_existente,
)
from scripts.xbz_feed.report import gerar_relatorio
from scripts.xbz_feed.resolve import resolver_todos
from scripts.xbz_feed.review_html import gerar_e_salvar
from scripts.xbz_feed.supabase_client import SupabaseREST
from scripts.xbz_feed.validate import validar_imagens_http, validar_linhas


def stage_collect():
    print("=" * 70)
    print("FASE 1 — COLETA")
    print("=" * 70)
    coletar_todos()


CAPA_META_FILE = config.DATA_DIR / "capa_status.json"


def stage_images():
    print("=" * 70)
    print("FASE 2 — IMAGENS")
    print("=" * 70)
    resolvidos = resolver_todos()

    tem_service_key = config.SUPABASE_SERVICE_ROLE_KEY is not None
    service_client = None
    if tem_service_key:
        service_client = SupabaseREST(use_service_role=True)
        service_client.ensure_bucket(config.STORAGE_BUCKET, public=True)
    else:
        print("[IMAGES] AVISO: SUPABASE_SERVICE_ROLE_KEY não definida - imagens novas "
              "serão baixadas/normalizadas localmente mas NÃO enviadas ao Storage ainda.")

    capa_status: dict[str, dict] = {}

    for p in resolvidos:
        if not p.imagem_principal:
            capa_status[p.codigo_entrada] = {"ok": False, "motivo": "sem imagem principal"}
            continue

        if p.imagem_principal.fonte.startswith("curada"):
            r = validar_url_existente(p.imagem_principal.url)
            print(f"[IMAGES] {p.codigo_entrada}: validando URL curada existente -> "
                  f"{'OK' if r['ok'] else 'FALHOU'} (status={r.get('status')})")
            capa_status[p.codigo_entrada] = {
                "ok": r["ok"], "url": p.imagem_principal.url, "reaproveitada": True,
                "detalhe": r,
            }
            continue

        # código sem curadoria: baixar, classificar, normalizar
        proc = processar_imagem_nao_curada(p.codigo_entrada, 1, p.imagem_principal)
        entrada = {
            "ok": proc.ok,
            "motivo": proc.motivo_reprovacao,
            "watermark_suspeito": proc.watermark_suspeito,
            "local_path": proc.local_path,
            "sha256": proc.sha256,
            "reaproveitada": False,
        }
        if proc.ok:
            if tem_service_key:
                url = enviar_para_storage(proc, service_client)
                entrada["url"] = url
                entrada["upload_pendente"] = False
            else:
                entrada["url"] = None
                entrada["upload_pendente"] = True
        capa_status[p.codigo_entrada] = entrada

    CAPA_META_FILE.write_text(json.dumps(capa_status, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[IMAGES] status salvo em {CAPA_META_FILE}")
    return resolvidos, capa_status


def stage_review(resolvidos=None, capa_status=None):
    print("=" * 70)
    print("REVISÃO DE IMAGENS (output/revisao_imagens.html)")
    print("=" * 70)
    if resolvidos is None:
        resolvidos = resolver_todos()
    if capa_status is None:
        capa_status = json.loads(CAPA_META_FILE.read_text(encoding="utf-8")) if CAPA_META_FILE.exists() else {}

    imagens_processadas: dict[str, ImagemProcessada] = {}
    urls_capa_final: dict[str, str] = {}
    for p in resolvidos:
        st = capa_status.get(p.codigo_entrada)
        if not st:
            continue
        if st.get("watermark_suspeito"):
            imagens_processadas[p.codigo_entrada] = ImagemProcessada(
                codigo=p.codigo_entrada, slot=1, ok=st["ok"], watermark_suspeito=True,
            )
        url = st.get("url")
        if not url and st.get("local_path"):
            # ainda não subiu pro Storage - referencia o arquivo local processado
            # (o HTML de revisão é aberto localmente, então o caminho relativo funciona)
            rel = Path(st["local_path"]).resolve().relative_to(config.ROOT)
            url = "../" + str(rel).replace("\\", "/")
        if url:
            urls_capa_final[p.codigo_entrada] = url

    gerar_e_salvar(resolvidos, imagens_processadas, urls_capa_final)


def _capa_urls_publicas(capa_status: dict) -> dict[str, str]:
    """Só URLs públicas de verdade (Storage ou já hospedadas). Upload local pendente
    (sem SUPABASE_SERVICE_ROLE_KEY) NÃO entra aqui - vira image_link vazio no CSV,
    o produto fica de fora até o upload real acontecer."""
    return {codigo: st["url"] for codigo, st in capa_status.items() if st.get("url")}


def stage_csv(resolvidos=None, capa_status=None):
    print("=" * 70)
    print("FASE 3 — CSV")
    print("=" * 70)
    if resolvidos is None:
        resolvidos = resolver_todos()
    if capa_status is None:
        capa_status = json.loads(CAPA_META_FILE.read_text(encoding="utf-8")) if CAPA_META_FILE.exists() else {}

    capa_urls = _capa_urls_publicas(capa_status)
    linhas, avisos_por_codigo = gerar_csv(resolvidos, capa_urls, additional_urls={})
    return resolvidos, linhas, avisos_por_codigo


def stage_validate(resolvidos=None, linhas=None, avisos_por_codigo=None):
    print("=" * 70)
    print("FASE 4 — VALIDAÇÃO E RELATÓRIO")
    print("=" * 70)
    if linhas is None or resolvidos is None or avisos_por_codigo is None:
        resolvidos, linhas, avisos_por_codigo = stage_csv()

    total_processado = len(resolvidos)

    validas_campos, excluidos_campos = validar_linhas(linhas)
    print(f"[VALIDATE] {len(validas_campos)} linhas passaram na validação de campos, "
          f"{len(excluidos_campos)} excluídas")

    print("[VALIDATE] Checando HTTP 200 de image_link/additional_image_link...")
    validas_finais, excluidos_http = validar_imagens_http(validas_campos)
    print(f"[VALIDATE] {len(validas_finais)} linhas passaram na validação de imagem, "
          f"{len(excluidos_http)} excluídas")

    excluidos = excluidos_campos + excluidos_http

    # reescreve o CSV só com as linhas que passaram em tudo
    import csv as _csv
    from scripts.xbz_feed.csv_builder import HEADER
    out_path = config.OUTPUT_DIR / "feed_meta.csv"
    with open(out_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = _csv.DictWriter(f, fieldnames=HEADER, quoting=_csv.QUOTE_MINIMAL)
        writer.writeheader()
        for linha in validas_finais:
            writer.writerow(linha)
    print(f"[VALIDATE] CSV final reescrito com {len(validas_finais)} linhas em {out_path}")

    observacoes_gerais = [
        "additional_image_link foi deixado vazio para todos os produtos - decisão do usuário: "
        "preencher só após revisão manual em output/revisao_imagens.html (não existe 'foto coletiva "
        "com todas as cores' em nenhuma fonte de dado real, API ou curadoria).",
        "Campo 'material' deixado vazio para todos os produtos: nenhuma fonte (products_cache ou "
        "topprodutos_curadoria) tem uma coluna estruturada de material; o texto da descrição já "
        "menciona material quando a API/curadoria o informa em prosa.",
        "price = products_cache.preco_custo × multiplicador escalonado do product-feed do site "
        "(mesma fórmula do feed do Google) × (1 - 16%).",
    ]
    if not config.SUPABASE_SERVICE_ROLE_KEY:
        observacoes_gerais.append(
            "SUPABASE_SERVICE_ROLE_KEY não estava configurada nesta execução: imagens novas "
            "(códigos sem curadoria) foram baixadas e normalizadas em data/processed/ mas NÃO "
            "enviadas ao bucket catalogo-meta - por isso ficaram sem image_link válido e saíram do CSV."
        )

    gerar_relatorio(total_processado, len(validas_finais), avisos_por_codigo, excluidos, observacoes_gerais)
    return validas_finais, excluidos


def stage_all():
    stage_collect()
    resolvidos, capa_status = stage_images()
    stage_review(resolvidos, capa_status)
    resolvidos, linhas, avisos_por_codigo = stage_csv(resolvidos, capa_status)
    stage_validate(resolvidos, linhas, avisos_por_codigo)


STAGES = {
    "collect": stage_collect,
    "images": stage_images,
    "review": stage_review,
    "csv": stage_csv,
    "validate": stage_validate,
    "all": stage_all,
}


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("stage", choices=list(STAGES.keys()))
    args = parser.parse_args()
    STAGES[args.stage]()


if __name__ == "__main__":
    main()
