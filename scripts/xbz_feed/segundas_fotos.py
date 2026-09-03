"""Baixa a segunda foto de cada produto do catalogo a partir da galeria do site.

Ate aqui a segunda foto vinha do products_cache, que so tem uma imagem por cor
- entao o que aparecia era o mesmo produto em OUTRA cor. O que se quer e a foto
coletiva (todas as cores juntas), que e a segunda foto da pagina do produto no
site do fornecedor. Ver galeria_site.py para o porque de ter que ler a pagina.

Uso:
    python -m scripts.xbz_feed.segundas_fotos            # so baixa e processa
    python -m scripts.xbz_feed.segundas_fotos --enviar   # tambem sobe pro storage
"""
from __future__ import annotations

import argparse
import json
import sys
import tempfile
from pathlib import Path

import requests

from . import config, galeria_site, images, upload_via_function

DESTINO_JSON = config.ROOT / "data" / "segundas_fotos.json"


def _codigos_alvo() -> list[dict]:
    """Produtos ativos do catalogo + os codigos novos passados em data/novos_produtos.json."""
    from .supabase_client import SupabaseREST

    client = SupabaseREST()
    linhas = client.select(
        "catalogo_clientes",
        {"select": "codigo,nome,ativo,imagem_secundaria_url", "order": "ordem"},
    )
    alvo = [l for l in linhas if l["ativo"]]
    extras = config.ROOT / "data" / "novos_produtos.json"
    if extras.exists():
        for novo in json.loads(extras.read_text(encoding="utf-8")):
            alvo.append({"codigo": novo["codigo"], "nome": novo["nome"], "ativo": True,
                         "imagem_secundaria_url": None})
    return alvo


def baixar_e_processar(codigo: str) -> dict:
    url = galeria_site.segunda_foto(codigo)
    if not url:
        return {"codigo": codigo, "ok": False, "motivo": "sem galeria na pagina do produto"}
    try:
        r = requests.get(url, headers={"User-Agent": galeria_site.UA}, timeout=45)
        r.raise_for_status()
    except requests.RequestException as e:
        return {"codigo": codigo, "ok": False, "motivo": f"download falhou: {e}", "url": url}

    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as f:
        f.write(r.content)
        tmp = f.name
    try:
        proc = images.processar_imagem_local(codigo, 2, tmp)
    finally:
        Path(tmp).unlink(missing_ok=True)

    if not proc.ok:
        return {"codigo": codigo, "ok": False, "motivo": proc.motivo_reprovacao, "url": url}
    return {"codigo": codigo, "ok": True, "url": url, "local": proc.local_path,
            "sha256": proc.sha256, "watermark": proc.watermark_suspeito}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--enviar", action="store_true", help="sobe as imagens para o storage")
    ap.add_argument("--codigos", help="lista separada por virgula (padrao: catalogo inteiro)")
    args = ap.parse_args()

    if args.codigos:
        alvo = [{"codigo": c.strip(), "nome": ""} for c in args.codigos.split(",") if c.strip()]
    else:
        alvo = _codigos_alvo()
    print(f"[SEGUNDAS] {len(alvo)} produtos")

    resultados = []
    for i, p in enumerate(alvo, 1):
        cod = p["codigo"]
        print(f"\n[{i}/{len(alvo)}] {cod} {p.get('nome','')[:40]}")
        r = baixar_e_processar(cod)
        r["nome"] = p.get("nome", "")
        print("   ", "OK" if r["ok"] else "FALHA: " + r["motivo"])
        resultados.append(r)

    if args.enviar:
        upload_via_function.ensure_bucket()
        for r in resultados:
            if not r.get("ok"):
                continue
            dados = Path(r["local"]).read_bytes()
            nome = f"{r['codigo']}-2-v2.jpg"
            r["storage_url"] = upload_via_function.upload_bytes(nome, dados)
            print(f"[UPLOAD] {nome} -> ok")

    DESTINO_JSON.write_text(json.dumps(resultados, ensure_ascii=False, indent=1), encoding="utf-8")
    ok = sum(1 for r in resultados if r.get("ok"))
    print(f"\n[SEGUNDAS] {ok} ok / {len(resultados) - ok} sem foto. Detalhe em {DESTINO_JSON}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
