"""Monta as linhas dos produtos novos do catalogo de clientes.

Le products_cache (nome, custo, cores, foto principal) e a galeria do site
(foto coletiva, ver galeria_site.py), processa as duas imagens e escreve
data/novos_produtos.json. O envio ao storage e o SQL saem de sql_catalogo.py.
"""
from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path

import requests

from . import config, cores as mod_cores, galeria_site, images
from .supabase_client import SupabaseREST

DESTINO = config.ROOT / "data" / "novos_produtos.json"

# codigo -> (secao, rotulo da secao, grupo do story, rotulo do grupo)
DESTINOS = {
    "18962": ("MOCHILAS, BOLSAS TÉRMICAS E MALAS", "Mochilas, Bolsas e Malas", "bolsas-termicas", "Bolsas Térmicas"),
    "18967": ("MOCHILAS, BOLSAS TÉRMICAS E MALAS", "Mochilas, Bolsas e Malas", "bolsas-termicas", "Bolsas Térmicas"),
    "04846": ("MOCHILAS, BOLSAS TÉRMICAS E MALAS", "Mochilas, Bolsas e Malas", "bolsas-termicas", "Bolsas Térmicas"),
    "09150": ("MOCHILAS, BOLSAS TÉRMICAS E MALAS", "Mochilas, Bolsas e Malas", "bolsas-termicas", "Bolsas Térmicas"),
    "18961": ("MOCHILAS, BOLSAS TÉRMICAS E MALAS", "Mochilas, Bolsas e Malas", "bolsas-termicas", "Bolsas Térmicas"),
    "04098": ("COPOS, GARRAFAS E CANECAS", "Copos, Garrafas e Canecas", "garrafas", "Garrafas"),
    "04014": ("COPOS, GARRAFAS E CANECAS", "Copos, Garrafas e Canecas", "copos-e-canecas", "Copos e Canecas"),
    "14724": ("COPOS, GARRAFAS E CANECAS", "Copos, Garrafas e Canecas", "copos-e-canecas", "Copos e Canecas"),
    "04081": ("COPOS, GARRAFAS E CANECAS", "Copos, Garrafas e Canecas", "copos-e-canecas", "Copos e Canecas"),
    "18587": ("MARMITAS E TÁBUAS DE MADEIRA", "Marmitas e Tábuas", "tabuas", "Tábuas"),
    "18608": ("MARMITAS E TÁBUAS DE MADEIRA", "Marmitas e Tábuas", "tabuas", "Tábuas"),
    "18507": ("NECESSAIRES, PORTA JOIAS E KIT MANICURE", "Necessaires e Porta Joias", "necessaires-e-porta-joias", "Necessaires e Porta Joias"),
}

CAMPOS = ("codigo_amigavel,codigo_prefixo,nome,cor,preco_custo,image_url,is_variante,ativo")


def _baixar_processar(codigo: str, slot: int, url: str) -> str | None:
    r = requests.get(url, headers={"User-Agent": galeria_site.UA}, timeout=45)
    if r.status_code != 200:
        print(f"   slot {slot}: HTTP {r.status_code}")
        return None
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as f:
        f.write(r.content)
        tmp = f.name
    try:
        proc = images.processar_imagem_local(codigo, slot, tmp)
    finally:
        Path(tmp).unlink(missing_ok=True)
    return proc.local_path if proc.ok else None


def main() -> int:
    client = SupabaseREST()
    saida = []
    for i, (codigo, (cat, cat_rot, grupo, grupo_rot)) in enumerate(DESTINOS.items(), 1):
        print(f"\n[{i}/{len(DESTINOS)}] {codigo}")
        linhas = client.select("products_cache",
                               {"select": CAMPOS, "codigo_prefixo": f"eq.{codigo}"})
        if not linhas:
            print("   NAO ENCONTRADO em products_cache")
            continue

        # a linha nao-variante e a foto "neutra" do produto; sem ela, a primeira
        principal = next((l for l in linhas if not l.get("is_variante")), linhas[0])
        custo = principal.get("preco_custo")
        if custo is None:
            print("   SEM CUSTO - pulado (nao invento preco)")
            continue

        vistas, lista_cores = set(), []
        for l in linhas:
            bruta = l.get("cor")
            if not bruta:
                continue
            chave = mod_cores._norm(bruta)
            if not chave or chave in vistas:
                continue
            vistas.add(chave)
            lista_cores.append({"n": chave.title(), "h": mod_cores.hex_da_cor(bruta)})

        p1 = _baixar_processar(codigo, 1, principal["image_url"]) if principal.get("image_url") else None
        url2 = galeria_site.segunda_foto(codigo)
        p2 = _baixar_processar(codigo, 2, url2) if url2 else None

        saida.append({
            "codigo": codigo,
            "nome": (principal["nome"] or "").title(),
            "categoria": cat, "categoria_rotulo": cat_rot,
            "grupo": grupo, "grupo_rotulo": grupo_rot,
            "custo": float(custo),
            "cores": lista_cores,
            "local_1": p1, "local_2": p2,
            "url_1": principal.get("image_url"), "url_2": url2,
        })
        print(f"   {saida[-1]['nome']} | custo {custo} | {len(lista_cores)} cores | "
              f"foto1 {'ok' if p1 else 'FALTA'} | foto2 {'ok' if p2 else 'FALTA'}")

    DESTINO.write_text(json.dumps(saida, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\n[NOVOS] {len(saida)} produtos em {DESTINO}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
