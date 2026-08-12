"""Fase 3 — Mapeamento para o CSV do Meta Commerce Manager."""
from __future__ import annotations

import csv
import json

from . import config
from .pricing import calcular_preco_exibicao
from .resolve import ProdutoResolvido
from .text_clean import limpar_texto

HEADER = [
    "id", "title", "description", "availability", "condition", "price", "link",
    "image_link", "brand", "google_product_category", "fb_product_category",
    "quantity_to_sell_on_facebook", "sale_price", "sale_price_effective_date",
    "item_group_id", "gender", "color", "size", "age_group", "material", "pattern",
    "shipping", "shipping_weight", "offer_disclaimer", "offer_disclaimer_url",
    "video[0].url", "video[0].tag[0]", "gtin", "product_tags[0]", "product_tags[1]",
    "style[0]", "additional_image_link",
]

MAX_TITLE = 200
MAX_DESCRIPTION = 9999


def _montar_descricao(p: ProdutoResolvido) -> str:
    partes = []
    if p.descricao_base:
        partes.append(limpar_texto(p.descricao_base))

    if p.fonte_textos == "curada":
        if p.medidas_gravacao_texto:
            partes.append(p.medidas_gravacao_texto)
    else:
        medidas = []
        if p.altura:
            medidas.append(f"Altura: {p.altura:g} cm")
        if p.largura:
            medidas.append(f"Largura: {p.largura:g} cm")
        if p.profundidade:
            medidas.append(f"Profundidade: {p.profundidade:g} cm")
        if p.peso:
            medidas.append(f"Peso aproximado: {p.peso:g}g")
        if medidas:
            partes.append(" | ".join(medidas))

    if p.cores_disponiveis:
        partes.append(f"Cores disponíveis: {', '.join(p.cores_disponiveis)}")

    # Junta tudo numa ÚNICA linha (sem \n) - ver comentário em text_clean.limpar_texto.
    texto = limpar_texto(" | ".join(partes))
    return texto[:MAX_DESCRIPTION]


def _montar_link(p: ProdutoResolvido, avisos_linha: list[str]) -> str:
    if p.pai_slug and p.pai_ativo:
        return f"{config.SITE_LINK_BASE}/produto/{p.pai_slug}"
    if p.pai_categoria:
        avisos_linha.append(
            f"Sem página de produto ativa para '{p.codigo_entrada}' "
            f"(slug={p.pai_slug!r}, ativo={p.pai_ativo}); usando URL de categoria"
        )
        return f"{config.SITE_LINK_BASE}/categoria/{p.pai_categoria}"
    avisos_linha.append(f"Sem página de produto NEM categoria para '{p.codigo_entrada}' - link ficará vazio")
    return ""


def _montar_preco(p: ProdutoResolvido, avisos_linha: list[str]) -> str:
    if p.preco_custo is None:
        avisos_linha.append(f"price vazio para '{p.codigo_entrada}': preco_custo indisponível")
        return ""
    preco_exibicao = calcular_preco_exibicao(p.preco_custo)
    return f"{preco_exibicao:.2f} BRL"


def montar_linha(p: ProdutoResolvido, capa_url: str | None, additional_url: str | None) -> tuple[dict, list[str]]:
    avisos_linha: list[str] = list(p.avisos)

    titulo = (p.nome or "").strip()[:MAX_TITLE]
    if not titulo:
        avisos_linha.append(f"title vazio para '{p.codigo_entrada}'")

    linha = {campo: "" for campo in HEADER}
    linha["id"] = p.codigo_entrada
    linha["title"] = titulo
    linha["description"] = _montar_descricao(p)
    linha["availability"] = "in stock"
    linha["condition"] = "new"
    linha["price"] = _montar_preco(p, avisos_linha)
    linha["link"] = _montar_link(p, avisos_linha)
    linha["image_link"] = capa_url or ""
    if not linha["image_link"]:
        avisos_linha.append(f"image_link vazio para '{p.codigo_entrada}'")
    linha["brand"] = config.BRAND
    linha["quantity_to_sell_on_facebook"] = "999"
    linha["product_tags[0]"] = p.categoria_site or ""
    linha["additional_image_link"] = additional_url or ""

    return linha, avisos_linha


def gerar_csv(
    resolvidos: list[ProdutoResolvido],
    capa_urls: dict[str, str],
    additional_urls: dict[str, str] | None = None,
) -> tuple[list[dict], dict[str, list[str]]]:
    additional_urls = additional_urls or {}
    linhas = []
    avisos_por_codigo: dict[str, list[str]] = {}

    for p in resolvidos:
        if not p.encontrado_api and not p.encontrado_curadoria:
            avisos_por_codigo[p.codigo_entrada] = [f"'{p.codigo_entrada}' não encontrado - excluído do CSV"]
            continue
        linha, avisos = montar_linha(p, capa_urls.get(p.codigo_entrada), additional_urls.get(p.codigo_entrada))
        linhas.append(linha)
        if avisos:
            avisos_por_codigo[p.codigo_entrada] = avisos

    out_path = config.OUTPUT_DIR / "feed_meta.csv"
    with open(out_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=HEADER, quoting=csv.QUOTE_MINIMAL)
        writer.writeheader()
        for linha in linhas:
            writer.writerow(linha)
    print(f"[CSV] {len(linhas)} linhas escritas em {out_path}")

    return linhas, avisos_por_codigo
