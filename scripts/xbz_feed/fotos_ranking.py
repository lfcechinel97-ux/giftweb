"""Baixa as fotos dos produtos da planilha de ranking de vendas da XBZ.

Para cada produto (CODIGO PAI, na ordem da planilha) le a pagina
https://www.xbzbrindes.com.br/<codigo> e baixa:
  - a foto de cada variacao de cor (amostras de cor da pagina, que trazem
    a foto, o nome da cor e o SKU em data-itemreferencia);
  - a segunda foto da galeria (sufixo d1 - normalmente a foto com todas as cores).

Nome dos arquivos:
  "<Nome do produto> <COR> <SKU>.jpg"          ex.: Mochila de Nylon USB 20L PRETO 01326-PRE.jpg
  "<Nome do produto> FOTO 2 <CODIGO>.jpg"      ex.: Mochila de Nylon USB 20L FOTO 2 01326.jpg

Uso:
    python3 scripts/xbz_feed/fotos_ranking.py planilha.xlsx saida/ --inicio 1 --fim 200
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
_IMG_RE = re.compile(r'(/img/produtos/[^"\'\s]+?-(\d+)d(\d+)-\d+\.(?:jpg|jpeg|png|webp))', re.I)
_TITULO_RE = re.compile(r"<meta property='og:title' content='Brinde ([^']+)'", re.I)


def codigo_pai(valor) -> str:
    s = str(valor).strip()
    return s.zfill(5) if s.isdigit() else s.upper()


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
        itens.append({"codigo": cod, "variacao": str(linha[4] or "").strip(),
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


def analisar(pagina: str) -> tuple[str | None, list[dict], str | None]:
    m = _TITULO_RE.search(pagina)
    nome = htmlmod.unescape(m.group(1)).strip() if m else None
    cores, vistos = [], set()
    for tag in _COR_RE.findall(pagina):
        a = {k: htmlmod.unescape(v) for k, v in _ATTR_RE.findall(tag)}
        sku, src = a.get("data-itemreferencia", "").strip(), a.get("data-src", "")
        if not sku or not src or sku in vistos:
            continue
        vistos.add(sku)
        cores.append({"sku": sku, "cor": (a.get("title") or a.get("alt") or "").strip().upper(), "src": src})
    detalhes = sorted({(int(n), c) for c, _id, n in _IMG_RE.findall(pagina)})
    segunda = detalhes[0][1] if detalhes else None
    return nome, cores, segunda


def baixar(sessao, caminho: str, destino: Path) -> bool:
    if destino.exists() and destino.stat().st_size > 0:
        return True
    url = caminho if caminho.startswith("http") else CDN + caminho
    r = get(sessao, url)
    if r is None or not r.headers.get("content-type", "").startswith("image"):
        return False
    ext = Path(url.split("?")[0]).suffix.lower() or ".jpg"
    destino = destino.with_suffix(ext)
    destino.write_bytes(r.content)
    time.sleep(PAUSA / 2)
    return True


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("planilha", type=Path)
    ap.add_argument("saida", type=Path)
    ap.add_argument("--inicio", type=int, default=1, help="posicao inicial no ranking (1 = mais vendido)")
    ap.add_argument("--fim", type=int, default=200, help="posicao final no ranking (inclusive)")
    args = ap.parse_args()

    itens = ler_planilha(args.planilha)[args.inicio - 1:args.fim]
    args.saida.mkdir(parents=True, exist_ok=True)
    sessao = requests.Session()
    sessao.headers["User-Agent"] = UA
    relatorio = []

    for pos, item in enumerate(itens, start=args.inicio):
        cod = item["codigo"]
        r = get(sessao, f"{SITE}/{cod}")
        time.sleep(PAUSA)
        if r is None:
            print(f"[{pos}] {cod}: pagina nao encontrada")
            relatorio.append({"posicao": pos, "codigo": cod, "produto": item["produto"],
                              "status": "pagina nao encontrada", "arquivo": "", "url": ""})
            continue
        nome, cores, segunda = analisar(r.text)
        nome = limpar(nome or item["produto"].title())
        ok = 0
        for c in cores:
            arq = args.saida / f"{limpar(f'{nome} {c['cor']} {c['sku']}')}.jpg"
            sucesso = baixar(sessao, c["src"], arq)
            ok += sucesso
            relatorio.append({"posicao": pos, "codigo": cod, "produto": nome,
                              "status": "ok" if sucesso else "falha download",
                              "arquivo": arq.name, "url": CDN + c["src"]})
        if segunda:
            arq = args.saida / f"{limpar(f'{nome} FOTO 2 {cod}')}.jpg"
            sucesso = baixar(sessao, segunda, arq)
            relatorio.append({"posicao": pos, "codigo": cod, "produto": nome,
                              "status": "ok" if sucesso else "falha download",
                              "arquivo": arq.name, "url": CDN + segunda})
        else:
            relatorio.append({"posicao": pos, "codigo": cod, "produto": nome,
                              "status": "sem segunda foto", "arquivo": "", "url": ""})
        if not cores:
            relatorio.append({"posicao": pos, "codigo": cod, "produto": nome,
                              "status": "sem fotos por cor", "arquivo": "", "url": ""})
        print(f"[{pos}] {cod} {nome}: {ok}/{len(cores)} cores, foto 2: {'sim' if segunda else 'nao'}")

    with open(args.saida / "relatorio.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=["posicao", "codigo", "produto", "status", "arquivo", "url"], delimiter=";")
        w.writeheader()
        w.writerows(relatorio)


if __name__ == "__main__":
    sys.exit(main())
