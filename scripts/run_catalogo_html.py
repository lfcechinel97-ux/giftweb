#!/usr/bin/env python
"""Processa as fotos (principal + secundária) dos produtos aprovados em
data/catalogo_aprovados_giftweb.csv para o catálogo HTML (não é o feed Meta).
Idempotente: já processados/hospedados são reaproveitados."""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scripts.xbz_feed import config
from scripts.xbz_feed.catalogo_html import (
    OUT_CSV,
    OUT_JSON,
    STATUS_PATH,
    carregar_linhas,
    processar_produto,
)


def main():
    linhas = carregar_linhas()
    print(f"[CATALOGO-HTML] {len(linhas)} produtos aprovados a processar")

    resultados = []
    for i, linha in enumerate(linhas, start=1):
        print(f"[CATALOGO-HTML] ({i}/{len(linhas)}) {linha['codigo']} - {linha.get('nome') or linha.get('_nome_original_sem_codigo')}")
        try:
            resultado = processar_produto(linha)
        except Exception as exc:
            print(f"[CATALOGO-HTML] ERRO em {linha['codigo']}: {exc}")
            resultado = {"codigo": linha["codigo"], "nome": linha.get("nome", ""), "erro": str(exc)}
        resultados.append(resultado)

    STATUS_PATH.write_text(json.dumps(resultados, ensure_ascii=False, indent=2), encoding="utf-8")
    OUT_JSON.write_text(json.dumps(resultados, ensure_ascii=False, indent=2), encoding="utf-8")

    import csv
    campos = ["codigo", "nome", "categoria", "subcategoria", "custo", "origem", "image_url", "image_url_secundaria"]
    with open(OUT_CSV, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=campos, extrasaction="ignore")
        w.writeheader()
        for r in resultados:
            w.writerow(r)

    sem_principal = [r["codigo"] for r in resultados if not r.get("image_url")]
    sem_secundaria = [r["codigo"] for r in resultados if not r.get("image_url_secundaria")]
    print(f"[CATALOGO-HTML] DONE - {len(resultados)} produtos processados")
    print(f"[CATALOGO-HTML] sem foto principal: {len(sem_principal)} {sem_principal}")
    print(f"[CATALOGO-HTML] sem foto secundária: {len(sem_secundaria)} {sem_secundaria}")


if __name__ == "__main__":
    main()
