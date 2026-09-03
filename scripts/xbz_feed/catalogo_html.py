"""Catálogo HTML (diferente do feed Meta): baixa/normaliza/hospeda a foto
principal (a URL exata dada em catalogo_aprovados_giftweb.csv, coluna 'foto')
e uma foto secundária (candidato #1 - outra variante de cor / galeria curada,
mesma regra já usada nos outros catálogos) para cada produto aprovado.
Não gera CSV do Meta - só garante que cada produto tenha as 2 fotos
hospedadas, prontas pro usuário montar o catálogo HTML dele.
"""
from __future__ import annotations

import csv
import json

from . import config
from .images import (
    ImagemCandidata,
    enviar_para_storage,
    processar_imagem_nao_curada,
    validar_url_existente,
)
from .resolve import resolver_produto

CSV_PATH = config.DATA_DIR / "catalogo_aprovados_giftweb.csv"
STATUS_PATH = config.DATA_DIR / "catalogo_html_status.json"
OUT_JSON = config.OUTPUT_DIR / "catalogo_html_produtos.json"
OUT_CSV = config.OUTPUT_DIR / "catalogo_html_produtos.csv"
URLS_CORRIGIDAS_PATH = config.DATA_DIR / "urls_corrigidas_final.json"

# A planilha catalogo_aprovados_giftweb.csv veio com um hífen faltando antes do
# ID numérico em quase toda URL da coluna 'foto' (ex: BRANCO22790 em vez de
# BRANCO-22790), causando 404/500 em 121 de 123 produtos. Reparado via regex +
# verificação HTTP real contra o CDN (114) e, pros 7 que não deram pra reparar
# por padrão, usada a URL equivalente (mesmo código/cor) já coletada da API -
# não é outra foto, é a mesma, só que sem a corrupção (2026-08-14).
_URLS_CORRIGIDAS: dict[str, str] = (
    json.loads(URLS_CORRIGIDAS_PATH.read_text(encoding="utf-8")) if URLS_CORRIGIDAS_PATH.exists() else {}
)

# Os 2 produtos sem código na planilha (fonte_gw), resolvidos por nome contra
# o catálogo já mapeado antes (2026-08-14): mesma categoria "Garrafas Trend".
RESOLUCOES_SEM_CODIGO = {
    "Garrafa Led Termometro 500 Ml": "14794",
    "Garrafa Quencher 1,2L": "06033",
}


def carregar_linhas() -> list[dict]:
    with open(CSV_PATH, encoding="utf-8-sig") as f:
        linhas = list(csv.DictReader(f))
    for linha in linhas:
        if not linha["codigo"]:
            codigo = RESOLUCOES_SEM_CODIGO.get(linha["fonte_gw"])
            if not codigo:
                raise ValueError(f"Sem resolução conhecida para produto sem código: {linha}")
            linha["codigo"] = codigo
            linha["_nome_original_sem_codigo"] = linha["fonte_gw"]

        corrigida = _URLS_CORRIGIDAS.get(linha["codigo"])
        if corrigida and corrigida != linha.get("foto"):
            linha["_foto_original"] = linha.get("foto")
            linha["foto"] = corrigida
    return linhas


def processar_produto(linha: dict) -> dict:
    codigo = linha["codigo"]
    raw_path = config.RAW_DIR / f"{codigo}.json"
    if not raw_path.exists():
        raise FileNotFoundError(f"data/raw/{codigo}.json não existe - rode a coleta primeiro")
    registro = json.loads(raw_path.read_text(encoding="utf-8"))
    p = resolver_produto(registro)

    resultado = {
        "codigo": codigo,
        "nome": linha.get("nome") or linha.get("_nome_original_sem_codigo") or p.nome,
        "categoria": linha.get("categoria", ""),
        "subcategoria": linha.get("subcategoria", ""),
        "custo": linha.get("custo", ""),
        "origem": linha.get("origem", ""),
        "image_url": None,
        "image_url_secundaria": None,
        "avisos": [],
    }

    if linha.get("_foto_original"):
        resultado["avisos"].append(
            f"URL da planilha estava corrompida (hífen faltando) - corrigida automaticamente: "
            f"{linha['_foto_original']} -> {linha['foto']}"
        )

    # ---- principal: EXATAMENTE a URL dada na planilha (quando existir) ----
    foto_url = linha.get("foto")
    if foto_url:
        candidata = ImagemCandidata(foto_url, "planilha:foto", "Foto escolhida na planilha aprovada")
    elif p.imagem_principal:
        candidata = p.imagem_principal
        resultado["avisos"].append("Sem 'foto' na planilha (produto sem código) - usada imagem principal resolvida do Supabase")
    else:
        candidata = None
        resultado["avisos"].append("Sem foto principal disponível em nenhuma fonte")

    if candidata:
        if candidata.fonte.startswith("curada"):
            r = validar_url_existente(candidata.url)
            resultado["image_url"] = candidata.url if r["ok"] else None
            if not r["ok"]:
                resultado["avisos"].append(f"foto curada não respondeu 200: {candidata.url}")
        else:
            proc = processar_imagem_nao_curada(codigo, 1, candidata)
            if proc.ok:
                url = enviar_para_storage(proc)
                resultado["image_url"] = url
                if proc.watermark_suspeito:
                    resultado["avisos"].append("SUSPEITA_WATERMARK na foto principal")
            else:
                resultado["avisos"].append(f"foto principal reprovada: {proc.motivo_reprovacao}")

    # ---- secundária: candidato #1 que não seja a mesma URL usada como principal ----
    candidatos_validos = [c for c in p.candidatos_secundarios if not candidata or c.url != candidata.url]
    if candidatos_validos:
        cand2 = candidatos_validos[0]
        if cand2.fonte.startswith("curada"):
            r = validar_url_existente(cand2.url)
            resultado["image_url_secundaria"] = cand2.url if r["ok"] else None
        else:
            proc2 = processar_imagem_nao_curada(codigo, 2, cand2)
            if proc2.ok:
                url2 = enviar_para_storage(proc2)
                resultado["image_url_secundaria"] = url2
            else:
                resultado["avisos"].append(f"foto secundária reprovada: {proc2.motivo_reprovacao}")
    else:
        resultado["avisos"].append("Nenhum candidato a foto secundária encontrado")

    return resultado


if __name__ == "__main__":
    print("Use scripts/run_catalogo_html.py")
