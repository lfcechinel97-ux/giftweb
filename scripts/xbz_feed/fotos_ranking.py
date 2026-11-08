"""Baixa as fotos dos produtos da planilha de ranking de vendas da XBZ.

Para cada CODIGO PAI (na ordem da planilha, sem repetir) abre a pagina do
produto no site da XBZ e baixa:
  - a foto de TODAS as variacoes de cor (amostras de cor da pagina: cada uma
    traz a foto, o nome da cor e o SKU em data-itemreferencia);
  - a segunda foto da galeria do produto (normalmente a das cores juntas).

Saida:
  <saida>/<CODIGO PAI>/<Produto> <COR> <SKU>.jpg
  <saida>/<CODIGO PAI>/<Produto> <CODIGO PAI> SEGUNDA FOTO.jpg

O codigo da planilha nem sempre e o da URL (13803N abre em /13803), entao
tenta: codigo pai, codigo sem letras finais, codigo da variacao. A pagina so
e aceita se o titulo da galeria comecar pelo codigo pai esperado.

Uso:
    python3 scripts/xbz_feed/fotos_ranking.py planilha.xlsx "produtos top 200 xbz" --inicio 1 --fim 200
"""
from __future__ import annotations

import argparse
import csv
import html as htmlmod
import re
import sys
import time
from pathlib import Path

import openpyxl
import requests

SITE = "https://www.xbzbrindes.com.br"
CDN = "https://cdn.xbzbrindes.com.br"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")
PAUSA = 0.5

_COR_RE = re.compile(r"<img\b[^>]*\bjs-corimg\b[^>]*>", re.I)
_ATTR_RE = re.compile(r'([\w-]+)="([^"]*)"')
# galeria do produto principal (os relacionados usam outra marcacao)
_GALERIA_RE = re.compile(r'href="(/img/produtos/[^"]+)" rel="fancybox_item" title="([^"]*)"', re.I)


def codigo_pai(valor) -> str:
    s = str(valor).strip().upper()
    return s.zfill(5) if s.isdigit() else s


def ler_planilha(caminho: Path) -> list[dict]:
    ws = openpyxl.load_workbook(caminho, read_only=True).active
    vistos, itens = set(), []
    for linha in ws.iter_rows(min_row=2, values_only=True):
        if not linha or linha[3] is None:
            continue
        cod = codigo_pai(linha[3])
        if cod in vistos:
            continue
        vistos.add(cod)
        itens.append({"codigo": cod, "variacao": str(linha[4] or "").strip().upper(),
                      "produto": str(linha[5] or "").strip()})
    return itens


def limpar(nome: str) -> str:
    nome = re.sub(r'[\\/:*?"<>|]+', "-", nome)
    return re.sub(r"\s+", " ", nome).strip(" .")


def get(sessao: requests.Session, url: str) -> requests.Response | None:
    for tentativa in range(3):
        try:
            r = sessao.get(url, timeout=40)
            if r.status_code == 404:
                return None
            r.raise_for_status()
            return r
        except requests.RequestException:
            time.sleep(2 * (tentativa + 1))
    return None


def candidatos_url(item: dict) -> list[str]:
    cod = item["codigo"]
    sem_prefixo = re.sub(r"^[^0-9]*@", "", cod)          # P@18596 -> 18596
    m = re.match(r"^(\d+)([A-Z]*)$", sem_prefixo)
    zerado = m.group(1).zfill(5) + m.group(2) if m else ""  # 9139A -> 09139A
    c = [cod, zerado, sem_prefixo, re.sub(r"[A-Z]+$", "", cod),
         item["variacao"], item["variacao"].split("-")[0]]
    vistos, saida = set(), []
    for x in c:
        if x and x not in vistos:
            vistos.add(x)
            saida.append(x)
    return saida


def analisar(pagina: str) -> dict:
    galeria = [(htmlmod.unescape(h), htmlmod.unescape(t)) for h, t in _GALERIA_RE.findall(pagina)]
    titulo = galeria[0][1] if galeria else ""
    codigo_pag, _, nome = titulo.partition(" - ")
    cores, vistos = [], set()
    for tag in _COR_RE.findall(pagina):
        a = {k: htmlmod.unescape(v) for k, v in _ATTR_RE.findall(tag)}
        sku, src = a.get("data-itemreferencia", "").strip().upper(), a.get("data-src", "")
        if not sku or not src or sku in vistos:
            continue
        vistos.add(sku)
        cores.append({"sku": sku, "cor": (a.get("title") or a.get("alt") or "").strip().upper(), "src": src})
    urls = []
    for h, _ in galeria:
        if h not in urls:
            urls.append(h)
    return {"codigo": codigo_pag.strip().upper(), "nome": nome.strip(), "cores": cores,
            "principal": urls[0] if urls else None,
            "segunda": urls[1] if len(urls) > 1 else None}


def abrir_pagina(sessao, item: dict, cache: Path) -> tuple[str | None, dict | None]:
    for cand in candidatos_url(item):
        arq = cache / f"{cand}.html"
        if arq.exists():
            texto = arq.read_text(encoding="utf-8", errors="replace")
        else:
            r = get(sessao, f"{SITE}/{cand}")
            time.sleep(PAUSA)
            if r is None:
                continue
            texto = r.text
            arq.write_text(texto, encoding="utf-8")
        info = analisar(texto)
        # aceita a pagina so se for mesmo do produto esperado
        if info["codigo"] == item["codigo"] or any(c["sku"].startswith(item["codigo"] + "-") for c in info["cores"]):
            return cand, info
    return None, None


def baixar(sessao, caminho: str, destino: Path) -> bool:
    url = caminho if caminho.startswith("http") else CDN + caminho
    ext = Path(url.split("?")[0]).suffix.lower() or ".jpg"
    destino = destino.with_suffix(ext)
    if destino.exists() and destino.stat().st_size > 0:
        return True
    r = get(sessao, url)
    if r is None or not r.headers.get("content-type", "").startswith("image"):
        return False
    destino.write_bytes(r.content)
    time.sleep(PAUSA / 2)
    return True


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("planilha", type=Path)
    ap.add_argument("saida", type=Path)
    ap.add_argument("--inicio", type=int, default=1, help="posicao inicial no ranking (1 = mais vendido)")
    ap.add_argument("--fim", type=int, default=200, help="posicao final no ranking (inclusive)")
    ap.add_argument("--cache", type=Path, default=None, help="pasta para guardar o HTML das paginas")
    args = ap.parse_args()

    itens = ler_planilha(args.planilha)[args.inicio - 1:args.fim]
    args.saida.mkdir(parents=True, exist_ok=True)
    cache = args.cache or args.saida.parent / "_cache_paginas_xbz"
    cache.mkdir(parents=True, exist_ok=True)
    sessao = requests.Session()
    sessao.headers["User-Agent"] = UA
    relatorio = []

    def reg(pos, cod, nome, status, arquivo="", url=""):
        relatorio.append({"posicao": pos, "codigo_pai": cod, "produto": nome,
                          "status": status, "arquivo": arquivo, "url": url})

    for pos, item in enumerate(itens, start=args.inicio):
        cod = item["codigo"]
        url_cod, info = abrir_pagina(sessao, item, cache)
        if not info:
            print(f"[{pos}] {cod}: pagina nao encontrada")
            reg(pos, cod, item["produto"], "pagina nao encontrada")
            continue
        nome = limpar(info["nome"] or item["produto"].title())
        pasta = args.saida / limpar(cod)
        pasta.mkdir(exist_ok=True)
        cores = info["cores"]
        if not cores and info["principal"]:
            # produto sem amostra de cor: a foto principal e a unica variacao
            cores = [{"sku": item["variacao"] or cod, "cor": "", "src": info["principal"]}]
        ok = 0
        for c in cores:
            arq = pasta / f"{limpar(f'{nome} {c['cor']} {c['sku']}')}.jpg"
            sucesso = baixar(sessao, c["src"], arq)
            ok += sucesso
            reg(pos, cod, nome, "ok" if sucesso else "falha download", arq.name, CDN + c["src"])
        if info["segunda"]:
            arq = pasta / f"{limpar(f'{nome} {cod} SEGUNDA FOTO')}.jpg"
            sucesso = baixar(sessao, info["segunda"], arq)
            reg(pos, cod, nome, "ok" if sucesso else "falha download", arq.name, CDN + info["segunda"])
        else:
            reg(pos, cod, nome, "sem segunda foto")
        extra = f" (url /{url_cod})" if url_cod != cod else ""
        print(f"[{pos}] {cod} {nome}: {ok}/{len(cores)} cores, segunda foto: {'sim' if info['segunda'] else 'NAO'}{extra}")

    with open(args.saida / "relatorio.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=["posicao", "codigo_pai", "produto", "status", "arquivo", "url"],
                           delimiter=";")
        w.writeheader()
        w.writerows(relatorio)


if __name__ == "__main__":
    sys.exit(main())
