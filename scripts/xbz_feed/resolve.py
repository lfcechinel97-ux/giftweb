"""Combina products_cache + topprodutos_curadoria (quando existir) num único
registro por código, priorizando dados curados para textos/imagens, e usando
sempre products_cache.preco_custo para preço (decisão do usuário)."""
from __future__ import annotations

import json
import re
import unicodedata
from dataclasses import dataclass, field

from . import config

_MEDIDAS_GRAVACAO_RE = re.compile(r"Medidas de gravaç[aã]o[^\n]*", re.IGNORECASE)

_MINUSCULAS = {"de", "da", "do", "das", "dos", "e", "com", "para", "sem", "a", "o", "em", "no", "na"}


def title_case_pt(texto: str) -> str:
    """Converte texto em CAIXA ALTA para um título legível, sem inventar nada -
    só reformata a mesma string. Mantém siglas conhecidas (ML, USB, LED, UV, TNT)."""
    siglas = {"ML", "USB", "LED", "UV", "TNT", "PU", "PVC", "CD", "DVD"}
    palavras = texto.strip().split()
    resultado = []
    for i, palavra in enumerate(palavras):
        base = palavra.strip(".,")
        if base.upper() in siglas:
            resultado.append(palavra.upper())
            continue
        lower = palavra.lower()
        if i > 0 and lower in _MINUSCULAS:
            resultado.append(lower)
        else:
            resultado.append(lower[:1].upper() + lower[1:] if lower else lower)
    return " ".join(resultado)


def _slug_simple(texto: str) -> str:
    nfkd = unicodedata.normalize("NFD", texto.lower())
    sem_acento = "".join(c for c in nfkd if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", "-", sem_acento).strip("-")


@dataclass
class ImagemCandidata:
    url: str
    fonte: str  # "curada:principal" | "curada:galeria" | "curada:cor" | "api:variante"
    label: str  # descrição curta pra mostrar no HTML de revisão


@dataclass
class ProdutoResolvido:
    codigo_entrada: str
    codigo_consulta: str
    encontrado_api: bool
    encontrado_curadoria: bool
    fonte_textos: str | None = None  # "curada" | "api" | None (nao encontrado)

    nome: str | None = None
    descricao_base: str | None = None  # texto livre, sem medidas/cores anexadas
    medidas_gravacao_texto: str | None = None  # só existe quando vem de descricao_longa curada
    categoria_site: str | None = None

    preco_custo: float | None = None

    peso: float | None = None
    altura: float | None = None
    largura: float | None = None
    profundidade: float | None = None

    cores_disponiveis: list[str] = field(default_factory=list)

    pai_slug: str | None = None
    pai_ativo: bool | None = None
    pai_categoria: str | None = None  # products_cache.categoria (p/ fallback de link de categoria)

    imagem_principal: ImagemCandidata | None = None
    candidatos_secundarios: list[ImagemCandidata] = field(default_factory=list)

    avisos: list[str] = field(default_factory=list)


def _escolher_pai(variantes: list[dict], codigo_consulta: str) -> dict | None:
    if not variantes:
        return None
    exato = [v for v in variantes if v["codigo_amigavel"] == codigo_consulta]
    if exato:
        return exato[0]
    nao_variante = [v for v in variantes if not v.get("is_variante")]
    if nao_variante:
        return nao_variante[0]
    return sorted(variantes, key=lambda v: v["codigo_amigavel"])[0]


def resolver_produto(registro: dict) -> ProdutoResolvido:
    codigo_entrada = registro["codigo_entrada"]
    codigo_consulta = registro["codigo_consulta"]
    variantes = registro.get("products_cache_variantes") or []
    curada = registro.get("topprodutos_curadoria")

    p = ProdutoResolvido(
        codigo_entrada=codigo_entrada,
        codigo_consulta=codigo_consulta,
        encontrado_api=bool(variantes),
        encontrado_curadoria=curada is not None,
    )

    if not variantes and not curada:
        p.avisos.append("Código não encontrado nem na API (products_cache) nem em topprodutos_curadoria")
        return p

    pai = _escolher_pai(variantes, codigo_consulta)

    # ---- preço: SEMPRE de products_cache.preco_custo (decisão do usuário) ----
    if pai and pai.get("preco_custo") is not None:
        p.preco_custo = float(pai["preco_custo"])
    else:
        # Linha "pai" às vezes fica com preco_custo NULL por causa do mecanismo de
        # override manual do sync-products (preco_custo_manual). Nesse caso, cai
        # para o valor mais comum entre as variantes de cor (que têm o custo real).
        candidatos = [float(v["preco_custo"]) for v in variantes
                      if v.get("preco_custo") is not None and v.get("codigo_amigavel") != codigo_consulta]
        if candidatos:
            distintos = sorted(set(candidatos))
            moda = max(distintos, key=candidatos.count)
            p.preco_custo = moda
            if len(distintos) > 1:
                p.avisos.append(
                    f"preco_custo do produto pai ausente; usado valor mais comum entre variantes "
                    f"({moda}), mas variantes de cor têm custos DIFERENTES entre si {distintos} - conferir manualmente"
                )
            else:
                p.avisos.append(f"preco_custo do produto pai ausente; usado valor das variantes de cor ({moda})")
        else:
            p.avisos.append("preco_custo ausente em products_cache para este código (pai e variantes)")

    # ---- dimensões / peso: sempre de products_cache (curadoria não tem colunas numéricas) ----
    if pai:
        p.peso = pai.get("peso")
        p.altura = pai.get("altura")
        p.largura = pai.get("largura")
        p.profundidade = pai.get("profundidade")
        p.pai_slug = pai.get("slug")
        p.pai_ativo = pai.get("ativo")
        p.pai_categoria = pai.get("categoria")

    # ---- cores disponíveis ----
    if curada and curada.get("cores"):
        p.cores_disponiveis = [c["nome"] for c in curada["cores"] if c.get("nome")]
    elif variantes:
        vistos = []
        for v in variantes:
            cor = v.get("cor")
            if cor and cor not in vistos:
                vistos.append(cor)
        p.cores_disponiveis = vistos

    # ---- textos: curada tem prioridade ----
    if curada:
        p.fonte_textos = "curada"
        p.nome = curada.get("nome")
        p.descricao_base = curada.get("descricao_curta") or curada.get("descricao_longa")
        p.categoria_site = curada.get("categoria")
        m = _MEDIDAS_GRAVACAO_RE.search(curada.get("descricao_longa") or "")
        if m:
            p.medidas_gravacao_texto = m.group(0).strip()
        else:
            p.avisos.append("topprodutos_curadoria sem 'Medidas de gravação' na descricao_longa")
    elif pai:
        p.fonte_textos = "api"
        p.nome = title_case_pt(pai.get("nome") or codigo_consulta)
        p.descricao_base = (pai.get("descricao") or "").strip() or None
        p.categoria_site = pai.get("categoria")
        p.avisos.append("Sem curadoria: medidas de gravação não disponíveis na API XBZ (não preenchidas)")
        if not p.descricao_base:
            p.avisos.append("descricao ausente na API para este código")
    else:
        p.avisos.append("Curadoria encontrada mas sem produto correspondente em products_cache")

    # ---- imagens: capa ----
    if curada and curada.get("imagem_principal"):
        p.imagem_principal = ImagemCandidata(curada["imagem_principal"], "curada:principal", "Foto principal (curada)")
    elif pai and pai.get("image_url"):
        p.imagem_principal = ImagemCandidata(pai["image_url"], "api:variante", f"Foto XBZ - cor {pai.get('cor', '?')}")
    else:
        p.avisos.append("Nenhuma imagem principal disponível (nem curada, nem API)")

    # ---- imagens: candidatos a secundária (para revisão manual - Fase 2.5) ----
    candidatos: list[ImagemCandidata] = []
    if curada:
        for url in curada.get("galeria") or []:
            candidatos.append(ImagemCandidata(url, "curada:galeria", "Galeria (curada)"))
        for c in curada.get("cores") or []:
            if c.get("imagem"):
                candidatos.append(ImagemCandidata(c["imagem"], "curada:cor", f"Cor {c.get('nome', '?')} (curada)"))
    for v in variantes:
        url = v.get("image_url")
        if url and (not p.imagem_principal or url != p.imagem_principal.url):
            candidatos.append(ImagemCandidata(url, "api:variante", f"Foto XBZ - cor {v.get('cor', '?')}"))
    # dedup preservando ordem
    vistos_urls = set()
    dedup = []
    for c in candidatos:
        if c.url not in vistos_urls:
            vistos_urls.add(c.url)
            dedup.append(c)
    p.candidatos_secundarios = dedup

    return p


def carregar_e_resolver(codigo_entrada: str) -> ProdutoResolvido:
    raw_path = config.RAW_DIR / f"{codigo_entrada}.json"
    with open(raw_path, encoding="utf-8") as f:
        registro = json.load(f)
    return resolver_produto(registro)


def resolver_todos() -> list[ProdutoResolvido]:
    from .codes import carregar_codigos

    resolvidos = []
    for entrada in carregar_codigos():
        resolvidos.append(carregar_e_resolver(entrada.original))
    return resolvidos
