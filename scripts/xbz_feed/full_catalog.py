"""Catálogo completo por categoria/destaque (WhatsApp Business).

Reaproveita collect/resolve/images do pipeline dos 43 produtos, mas com regras
de preenchimento próprias: title = nome comercial da lista (não o da XBZ),
price = placeholder fixo "100.00 BRL", description com fallback mais simples,
e duas colunas extras (categoria_interna, destaque) fora do padrão Meta.
"""
from __future__ import annotations

import csv
import json
import re
import unicodedata
from dataclasses import dataclass

from . import config
from .collect import carregar_curadoria_lookup, coletar_codigo
from .csv_builder import HEADER as META_HEADER
from .images import (
    ImagemProcessada,
    enviar_para_storage,
    processar_imagem_nao_curada,
    validar_url_existente,
)
from .resolve import resolver_produto
from .supabase_client import SupabaseREST
from .text_clean import limpar_texto

LISTA_FILE = config.DATA_DIR / "catalogo_completo_lista.json"
RAW_DIR2 = config.RAW_DIR  # mesmo diretório data/raw/<codigo>.json
OUT_FULL = config.OUTPUT_DIR / "feed_meta.csv"
OUT_META_ONLY = config.OUTPUT_DIR / "feed_meta_meta_only.csv"
CATALOG_CAPA_STATUS = config.DATA_DIR / "catalog_capa_status.json"
CATALOG_ADD_STATUS = config.DATA_DIR / "catalog_additional_status.json"

PRICE_PLACEHOLDER = "100.00 BRL"

# Decisão tomada com o usuário em 2026-08-14: "Sacola TNT Metalizada" bate com
# 2 códigos-pai igualmente completos (15452N e 15453N, só o tamanho difere).
# Escolhido 15452N como palpite - PRECISA confirmação do usuário.
RESOLUCOES_MANUAIS = {
    "Sacola TNT Metalizada": "15452N",
}
RESOLUCOES_AMBIGUAS_AVISO = {
    "15452N": "Código escolhido por palpite entre 2 igualmente válidos (15452N menor/41x37cm vs "
              "15453N maior/40,5x50cm, ambos 'SACOLA TNT METALIZADO', 11 variantes ativas cada). "
              "CONFIRME se é este que você vende.",
}

EXTRA_HEADER = ["categoria_interna", "destaque"]
FULL_HEADER = META_HEADER + EXTRA_HEADER


def _slug_ascii(texto: str) -> str:
    nfkd = unicodedata.normalize("NFD", texto.lower())
    sem_acento = "".join(c for c in nfkd if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", "-", sem_acento).strip("-")


@dataclass
class ItemCatalogo:
    categoria: str
    destaque: str
    nome: str
    codigo: str | None
    sem_sku_original: bool  # True = já veio sem código na lista original do usuário


def carregar_lista() -> list[ItemCatalogo]:
    with open(LISTA_FILE, encoding="utf-8") as f:
        bruto = json.load(f)
    itens = []
    for r in bruto:
        codigo = r["codigo"]
        sem_sku_original = codigo is None
        if codigo is None and r["nome"] in RESOLUCOES_MANUAIS:
            codigo = RESOLUCOES_MANUAIS[r["nome"]]
        itens.append(ItemCatalogo(r["categoria"], r["destaque"], r["nome"], codigo, sem_sku_original))
    return itens


def coletar_todos_novos(itens: list[ItemCatalogo]) -> None:
    print("=" * 70)
    print("COLETA - catálogo completo")
    print("=" * 70)
    client = SupabaseREST()
    curadoria_lookup = carregar_curadoria_lookup(client)

    from .codes import CodigoEntrada

    codigos_unicos = sorted({i.codigo for i in itens if i.codigo})
    print(f"[FULL] {len(codigos_unicos)} códigos únicos a coletar/atualizar")
    for codigo in codigos_unicos:
        coletar_codigo(client, CodigoEntrada(original=codigo, consulta=codigo), curadoria_lookup)


def _montar_descricao_simples(descricao_base: str | None, nome: str, categoria: str, avisos: list[str]) -> str:
    if descricao_base:
        texto = limpar_texto(descricao_base)
        if texto:
            return texto[:9999]
    avisos.append("description fraca: sem descrição cadastrada no Supabase, usado fallback nome + categoria")
    # categoria aqui é a categoria_interna (ex: "1. Copos Térmicos e Cuias") - tira o número/ponto inicial
    categoria_legivel = re.sub(r"^\d+\.\s*", "", categoria)
    return limpar_texto(f"{nome} — {categoria_legivel}")


def _montar_link(pai_slug, pai_ativo, pai_categoria, avisos: list[str]) -> str:
    if pai_slug and pai_ativo:
        return f"{config.SITE_LINK_BASE}/produto/{pai_slug}"
    if pai_categoria:
        avisos.append(f"Sem página de produto ativa (slug={pai_slug!r}, ativo={pai_ativo}); usando URL de categoria")
        return f"{config.SITE_LINK_BASE}/categoria/{pai_categoria}"
    avisos.append("Sem página de produto nem categoria mapeada; usando URL genérica do catálogo (/produtos)")
    return f"{config.SITE_LINK_BASE}/produtos"


def processar_item(item: ItemCatalogo, tem_service_key: bool, service_client) -> tuple[dict, list[str]]:
    avisos: list[str] = []

    if item.codigo is None:
        # SEM SKU XBZ e não encontrado por nome em nenhuma tabela
        id_provisorio = "sem-sku-" + _slug_ascii(item.nome)
        avisos.append(f"SEM SKU XBZ - não encontrado em nenhuma tabela do Supabase. "
                       f"id provisório '{id_provisorio}' - defina o SKU/slug real antes de publicar.")
        linha = {campo: "" for campo in FULL_HEADER}
        linha["id"] = id_provisorio
        linha["title"] = item.nome[:200]
        linha["description"] = _montar_descricao_simples(None, item.nome, item.categoria, avisos)
        linha["availability"] = "in stock"
        linha["condition"] = "new"
        linha["price"] = PRICE_PLACEHOLDER
        linha["link"] = _montar_link(None, None, None, avisos)
        linha["image_link"] = ""
        linha["brand"] = config.BRAND
        linha["quantity_to_sell_on_facebook"] = "999"
        linha["additional_image_link"] = ""
        linha["categoria_interna"] = item.categoria
        linha["destaque"] = item.destaque
        avisos.append("image_link vazio: produto sem foto real cadastrada")
        return linha, avisos

    if item.codigo in RESOLUCOES_AMBIGUAS_AVISO:
        avisos.append(RESOLUCOES_AMBIGUAS_AVISO[item.codigo])

    raw_path = config.RAW_DIR / f"{item.codigo}.json"
    with open(raw_path, encoding="utf-8") as f:
        registro = json.load(f)
    p = resolver_produto(registro)
    avisos.extend(p.avisos)

    if not p.encontrado_api and not p.encontrado_curadoria:
        avisos.append(f"código '{item.codigo}' não encontrado em products_cache nem topprodutos_curadoria")

    linha = {campo: "" for campo in FULL_HEADER}
    linha["id"] = item.codigo
    linha["title"] = item.nome[:200]  # nome COMERCIAL da lista, não o nome cru da XBZ
    linha["description"] = _montar_descricao_simples(p.descricao_base, item.nome, item.categoria, avisos)
    linha["availability"] = "in stock"
    linha["condition"] = "new"
    linha["price"] = PRICE_PLACEHOLDER
    linha["link"] = _montar_link(p.pai_slug, p.pai_ativo, p.pai_categoria, avisos)
    linha["brand"] = config.BRAND
    linha["quantity_to_sell_on_facebook"] = "999"
    linha["product_tags[0]"] = p.categoria_site or ""
    linha["categoria_interna"] = item.categoria
    linha["destaque"] = item.destaque

    # ---- imagem principal ----
    capa_status = {}
    if p.imagem_principal:
        if p.imagem_principal.fonte.startswith("curada"):
            r = validar_url_existente(p.imagem_principal.url)
            capa_status = {"ok": r["ok"], "url": p.imagem_principal.url, "reaproveitada": True}
            if not r["ok"]:
                avisos.append(f"image_link curada não respondeu 200: {p.imagem_principal.url}")
        else:
            proc = processar_imagem_nao_curada(item.codigo, 1, p.imagem_principal)
            capa_status = {"ok": proc.ok, "motivo": proc.motivo_reprovacao,
                           "watermark_suspeito": proc.watermark_suspeito,
                           "local_path": proc.local_path, "sha256": proc.sha256, "reaproveitada": False}
            if proc.ok:
                if tem_service_key:
                    capa_status["url"] = enviar_para_storage(proc, service_client)
                else:
                    capa_status["url"] = None
                    capa_status["upload_pendente"] = True
                    avisos.append("image_link vazio: foto baixada/normalizada em data/processed/ mas upload pendente (sem SUPABASE_SERVICE_ROLE_KEY)")
            else:
                avisos.append(f"image_link vazio: {proc.motivo_reprovacao}")
    else:
        avisos.append("image_link vazio: nenhuma imagem disponível (nem curada, nem API)")
    linha["image_link"] = capa_status.get("url") or ""

    # ---- imagem adicional (candidato #1, mesma regra aprovada em 2026-08-12) ----
    add_status = {}
    if p.candidatos_secundarios:
        candidato = p.candidatos_secundarios[0]
        if candidato.fonte.startswith("curada"):
            r = validar_url_existente(candidato.url)
            add_status = {"ok": r["ok"], "url": candidato.url, "reaproveitada": True}
        else:
            proc = processar_imagem_nao_curada(item.codigo, 2, candidato)
            add_status = {"ok": proc.ok, "local_path": proc.local_path, "sha256": proc.sha256, "reaproveitada": False}
            if proc.ok:
                if tem_service_key:
                    add_status["url"] = enviar_para_storage(proc, service_client)
                else:
                    add_status["url"] = None
                    add_status["upload_pendente"] = True
    else:
        avisos.append("additional_image_link vazio: nenhum candidato disponível")
    linha["additional_image_link"] = add_status.get("url") or ""

    return linha, avisos, capa_status, add_status


def gerar_catalogo_completo() -> None:
    itens = carregar_lista()
    coletar_todos_novos(itens)

    print("=" * 70)
    print("PROCESSANDO ITENS - imagens + mapeamento CSV")
    print("=" * 70)

    tem_service_key = config.SUPABASE_SERVICE_ROLE_KEY is not None
    service_client = None
    if tem_service_key:
        service_client = SupabaseREST(use_service_role=True)
        service_client.ensure_bucket(config.STORAGE_BUCKET, public=True)
    else:
        print("[FULL] AVISO: sem SUPABASE_SERVICE_ROLE_KEY - fotos novas ficam prontas em "
              "data/processed/ mas image_link/additional_image_link ficam vazios até o upload.")

    linhas = []
    avisos_por_id: dict[str, list[str]] = {}
    capa_status_all = {}
    add_status_all = {}

    for item in itens:
        print(f"[FULL] processando: {item.categoria} | {item.destaque} | {item.nome} (codigo={item.codigo})")
        resultado = processar_item(item, tem_service_key, service_client)
        if len(resultado) == 4:
            linha, avisos, capa_status, add_status = resultado
            capa_status_all[linha["id"]] = capa_status
            add_status_all[linha["id"]] = add_status
        else:
            linha, avisos = resultado
        linhas.append(linha)
        if avisos:
            avisos_por_id[linha["id"]] = avisos

    CATALOG_CAPA_STATUS.write_text(json.dumps(capa_status_all, ensure_ascii=False, indent=2), encoding="utf-8")
    CATALOG_ADD_STATUS.write_text(json.dumps(add_status_all, ensure_ascii=False, indent=2), encoding="utf-8")

    return linhas, avisos_por_id


def escrever_csvs(linhas: list[dict]) -> None:
    with open(OUT_FULL, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=FULL_HEADER, quoting=csv.QUOTE_MINIMAL)
        writer.writeheader()
        for linha in linhas:
            writer.writerow(linha)
    print(f"[FULL] {len(linhas)} linhas escritas em {OUT_FULL}")

    with open(OUT_META_ONLY, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=META_HEADER, quoting=csv.QUOTE_MINIMAL, extrasaction="ignore")
        writer.writeheader()
        for linha in linhas:
            writer.writerow(linha)
    print(f"[FULL] {len(linhas)} linhas escritas em {OUT_META_ONLY} (padrão Meta puro, sem colunas internas)")


if __name__ == "__main__":
    linhas, avisos = gerar_catalogo_completo()
    escrever_csvs(linhas)
