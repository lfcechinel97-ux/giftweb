"""Sobe as imagens novas e gera o SQL de atualizacao do catalogo de clientes.

Sai um arquivo .sql em vez de escrever direto na tabela porque catalogo_clientes
so aceita escrita de admin autenticado (RLS), e o processo aqui roda com a
chave publica. O SQL vai colado no SQL editor do Lovable Cloud, igual as
migrations.

Cobre tres coisas:
  1. segunda foto nova (a coletiva da galeria do fornecedor) dos produtos que ja
     estao no catalogo;
  2. insercao dos produtos novos, com as duas fotos;
  3. faixa de quantidade dos produtos novos.
"""
from __future__ import annotations

import hashlib
import json
import sys
import time
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

import requests

from . import config, upload_via_function

BUCKET_URL = f"{config.SUPABASE_URL}/storage/v1/object/public/catalogo-meta"


def _nome(codigo: str, slot: int, dados: bytes) -> str:
    """Nome do arquivo no storage, com 8 digitos do sha256 do conteudo.

    O esquema antigo era um contador de versao (-v1, -v2). Ele colide: o bucket
    ja tinha um "-2-v2.jpg" de trabalho anterior com outra imagem, e a edge
    function nao sobrescreve. Com o hash no nome, conteudo igual gera nome igual
    (reenviar e inofensivo) e conteudo diferente gera nome diferente - o que
    tambem resolve cache de navegador e de CDN sem precisar pensar nisso.
    """
    return f"{codigo}-{slot}-{hashlib.sha256(dados).hexdigest()[:8]}.jpg"


def _enviar(nome: str, dados: bytes) -> str:
    """Sobe o arquivo, aceitando o caso de ele ja estar la.

    A edge function nao sobrescreve (upsert desligado, de proposito - evita
    trocar foto por acidente). Numa reexecucao apos falha isso vira erro em
    tudo que ja subiu, entao aqui o "already exists" e aceito, mas so depois
    de conferir pelo HEAD que o arquivo remoto tem o mesmo tamanho do local.
    Diferente, o processo para: apontar para uma foto que nao e a que
    processamos seria pior que falhar.
    """
    try:
        # 520/502 da borda do Supabase aparecem de vez em quando numa sequencia
        # de ~100 envios; sao transitorios e passam na repeticao.
        ultimo: RuntimeError | None = None
        for tentativa in range(4):
            try:
                url = upload_via_function.upload_bytes(nome, dados)
                print(f"[UPLOAD] {nome}")
                return url
            except RuntimeError as e:
                if "already exists" in str(e):
                    raise
                ultimo = e
                print(f"[UPLOAD] {nome}: tentativa {tentativa + 1} falhou ({str(e)[-60:]})")
                time.sleep(2 * (tentativa + 1))
        raise ultimo  # type: ignore[misc]
    except RuntimeError as e:
        if "already exists" not in str(e):
            raise
        url = f"{BUCKET_URL}/{nome}"
        r = requests.head(url, timeout=30)
        remoto = int(r.headers.get("content-length", -1))
        if r.status_code != 200 or remoto != len(dados):
            raise RuntimeError(
                f"{nome} ja existe no storage com conteudo diferente "
                f"(remoto {remoto} bytes, local {len(dados)}). Nao sobrescrevi."
            ) from e
        print(f"[UPLOAD] {nome} (ja estava la, identico)")
        return url


SEGUNDAS = config.ROOT / "data" / "segundas_fotos.json"
NOVOS = config.ROOT / "data" / "novos_produtos.json"
SAIDA = config.ROOT / "supabase" / "migrations" / "20260904103000_catalogo_fotos_e_novos.sql"

# Mesma escada da carga inicial: 20 un. = custo x 2,5, 50 un. x 2,2, 100+ x 2,0.
MULT = (Decimal("2.5"), Decimal("2.2"), Decimal("2.0"))


def _r(v: Decimal) -> Decimal:
    return v.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _sql_txt(v: str | None) -> str:
    if v is None:
        return "NULL"
    return "'" + v.replace("'", "''") + "'"


def main() -> int:
    enviar = "--enviar" in sys.argv
    segundas = json.loads(SEGUNDAS.read_text(encoding="utf-8")) if SEGUNDAS.exists() else []
    novos = json.loads(NOVOS.read_text(encoding="utf-8")) if NOVOS.exists() else []

    if enviar:
        upload_via_function.ensure_bucket()
        for r in segundas:
            if not r.get("ok") or r.get("storage_url"):
                continue
            nome = _nome(r["codigo"], 2, Path(r["local"]).read_bytes())
            r["storage_url"] = _enviar(nome, Path(r["local"]).read_bytes())
            # grava a cada envio: uma queda no meio nao custa refazer os 80 anteriores
            SEGUNDAS.write_text(json.dumps(segundas, ensure_ascii=False, indent=1), encoding="utf-8")

        for n in novos:
            for slot in (1, 2):
                caminho = n.get(f"local_{slot}")
                if not caminho or n.get(f"storage_{slot}"):
                    continue
                nome = _nome(n["codigo"], slot, Path(caminho).read_bytes())
                n[f"storage_{slot}"] = _enviar(nome, Path(caminho).read_bytes())
                NOVOS.write_text(json.dumps(novos, ensure_ascii=False, indent=1), encoding="utf-8")

    linhas: list[str] = [
        "-- Fotos e produtos novos do catalogo de clientes.",
        "--",
        "-- 1) Segunda foto: ate aqui vinha do products_cache, que so guarda uma",
        "--    imagem por cor - o que aparecia no hover era o MESMO produto em outra",
        "--    cor. A foto coletiva (todas as cores juntas) so existe na galeria da",
        "--    pagina do produto no site do fornecedor. Ver scripts/xbz_feed/",
        "--    galeria_site.py.",
        "-- 2) Produtos novos pedidos, com as duas fotos e preco = custo x 2,5 / 2,2 / 2,0,",
        "--    a mesma conta da carga inicial das faixas.",
        "--",
        "-- Gerado por scripts/xbz_feed/sql_catalogo.py - nao editar a mao.",
        "",
        "-- ── 1. segunda foto (coletiva) ──",
    ]

    n_seg = 0
    for r in segundas:
        if not r.get("ok") or not r.get("storage_url"):
            continue
        linhas.append(
            f"UPDATE public.catalogo_clientes SET imagem_secundaria_url = "
            f"{_sql_txt(r['storage_url'])} WHERE codigo = {_sql_txt(r['codigo'])};")
        n_seg += 1

    linhas += ["", "-- ── 2. produtos novos ──"]
    for n in novos:
        custo = Decimal(str(n["custo"]))
        p1, p2, p3 = (_r(custo * m) for m in MULT)
        cores = json.dumps(n["cores"], ensure_ascii=False)
        linhas.append(
            "INSERT INTO public.catalogo_clientes\n"
            "  (codigo, nome, categoria, categoria_rotulo, grupo, grupo_rotulo, preco,\n"
            "   faixa1_qtd, faixa1_preco, faixa2_qtd, faixa2_preco, faixa3_qtd, faixa3_preco,\n"
            "   imagem_url, imagem_secundaria_url, cores, destaque, ativo, ordem)\n"
            f"VALUES ({_sql_txt(n['codigo'])}, {_sql_txt(n['nome'])}, {_sql_txt(n['categoria'])},\n"
            f"  {_sql_txt(n['categoria_rotulo'])}, {_sql_txt(n['grupo'])}, {_sql_txt(n['grupo_rotulo'])},\n"
            f"  {p1}, 20, {p1}, 50, {p2}, 100, {p3},\n"
            f"  {_sql_txt(n.get('storage_1'))}, {_sql_txt(n.get('storage_2'))},\n"
            f"  {_sql_txt(cores)}::jsonb, false, true,\n"
            "  (SELECT COALESCE(MAX(ordem), 0) + 1 FROM public.catalogo_clientes))\n"
            "ON CONFLICT (codigo) DO UPDATE SET\n"
            "  imagem_url = EXCLUDED.imagem_url,\n"
            "  imagem_secundaria_url = EXCLUDED.imagem_secundaria_url,\n"
            "  cores = EXCLUDED.cores,\n"
            "  ativo = true;")

    linhas += [
        "",
        "-- ── 3. faixa 100 / 200 / 1000 tambem nos produtos novos que caem em",
        "--    caneta, sacola ou no chaveiro 09824 (nenhum hoje, mas a regra fica",
        "--    valendo caso um deles entre nesses grupos depois) ──",
        "UPDATE public.catalogo_clientes",
        "SET faixa1_qtd = 100, faixa2_qtd = 200, faixa3_qtd = 1000",
        "WHERE (grupo IN ('canetas', 'sacolas') OR codigo = '09824')",
        "  AND faixa1_qtd IS DISTINCT FROM 100;",
    ]

    SAIDA.write_text("\n".join(linhas) + "\n", encoding="utf-8")
    print(f"\n[SQL] {n_seg} fotos + {len(novos)} produtos -> {SAIDA}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
