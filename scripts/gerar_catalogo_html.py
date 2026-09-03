#!/usr/bin/env python
"""Gera o catalogo B2B em HTML unico e autocontido (base64 embutido).

O visualizador de documentos do WhatsApp NAO executa JavaScript, entao o
arquivo NAO funciona como anexo. Ele e publicado em public/catalogo.html e
enviado como LINK - o navegador interno do WhatsApp roda JS normalmente.
"""
from __future__ import annotations

import base64
import csv
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from scripts.xbz_feed.story_groups import GRUPOS, gerar_icone, grupo_do_produto, slug

RAIZ = Path(__file__).resolve().parent.parent
CSV_IN = RAIZ / "output" / "catalogo_html_produtos.csv"
DIR_FOTOS = RAIZ / "data" / "catalogo_fotos"     # fotos ORIGINAIS, sem personalizacao
DIR_FONTS = RAIZ / "data" / "fonts"
DIR_ICONES = RAIZ / "data" / "story_icons"       # PNG recortado (transborda o circulo)
DIR_BANNERS = RAIZ / "data" / "banners"
LOGO = RAIZ / "public" / "logos" / "giftweb-logo.png"
OUT = RAIZ / "output" / "catalogo-giftweb.html"
PUBLICO = RAIZ / "public" / "catalogo.html"

WHATSAPP = "5548996652844"
MULTIPLICADOR = 2.5
QTD_INICIAL, QTD_PASSO, QTD_ATALHOS = 10, 5, (50, 100)

# banner_1 e o de Dia dos Pais (sazonal) - removido a pedido do usuario.
BANNERS = ["banner_2_desk.jpg", "banner_3_desk.jpg"]

# Custos ausentes no CSV, recuperados de products_cache (API XBZ).
# 14794 tem variantes com custos diferentes (17.60 e 26.00) - usado o mais comum.
CUSTOS_FALTANTES = {"14794": 17.60, "06033": 36.90}

# Os produtos de "Meus Vendidos" nao tem categoria no CSV - encaixados na
# categoria coerente para nao criarem uma secao orfa.
CATEGORIA_FALTANTE = {
    "14794": ("COPOS, GARRAFAS E CANECAS", "Garrafas Térmicas / Squeezes"),
    "06033": ("COPOS, GARRAFAS E CANECAS", "Garrafas Térmicas / Squeezes"),
    "01318": ("MOCHILAS, BOLSAS TÉRMICAS E MALAS", "Mochilas e Sacochilas"),
    "18921": ("COPOS, GARRAFAS E CANECAS", "Garrafas Térmicas / Squeezes"),
}

# Titulo das SECOES da pagina, que seguem as 10 categorias amplas do CSV.
# Os stories usam os 17 grupos proprios definidos em story_groups.py.
ROTULO_SECAO = {
    "COPOS, GARRAFAS E CANECAS": "Copos, Garrafas e Canecas",
    "MOCHILAS, BOLSAS TÉRMICAS E MALAS": "Mochilas, Bolsas e Malas",
    "CADERNETAS, AGENDAS, BLOCOS E CANETAS": "Cadernetas, Blocos e Canetas",
    "CAIXAS DE SOM, FONES E POWER BANK": "Som, Fones e Power Bank",
    "KIT CHURRASCO E KIT VINHO": "Kit Churrasco e Kit Vinho",
    "NECESSAIRES, PORTA JOIAS E KIT MANICURE": "Necessaires e Porta Joias",
    "CHAVEIROS, MOUSE PAD E KIT EXECUTIVO": "Chaveiros, Mouse Pad e Kit Executivo",
    "MARMITAS E TÁBUAS DE MADEIRA": "Marmitas e Tábuas",
    "SACOLA DE ALGODÃO E TNT": "Sacolas de Algodão e TNT",
    "GUARDA-CHUVAS": "Guarda-Chuvas",
}

BENEFICIOS = [
    ("Personalização inclusa", "Arte e gravação já no valor do produto"),
    ("Entrega para todo o Brasil", "Envio para qualquer cidade, com prazo confirmado"),
    ("Atendimento consultivo", "A gente ajuda a escolher o brinde certo"),
    ("Pedido a partir de 10 un.", "Quantidade mínima acessível para começar"),
]
ICONES = {
    "Personalização inclusa": '<path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/>',
    "Entrega para todo o Brasil": '<rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
    "Atendimento consultivo": '<path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/>',
    "Pedido a partir de 10 un.": '<path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
}


def b64(caminho: Path) -> str:
    return base64.b64encode(caminho.read_bytes()).decode("ascii")


def carregar_produtos() -> tuple[list[dict], list[str]]:
    with open(CSV_IN, encoding="utf-8-sig") as f:
        linhas = list(csv.DictReader(f))

    # Dedup por codigo: o 06033 aparece 2x na curadoria (como "Garrafa Quencher
    # 1,2L" em Meus Vendidos e como "CANECA TERMICA 1,2L" no Top10 da XBZ - e o
    # mesmo produto). Prevalece a linha de Meus Vendidos, que traz o nome
    # comercial que a Gift Web usa de verdade.
    por_codigo: dict[str, dict] = {}
    for r in linhas:
        cod = r["codigo"]
        if cod not in por_codigo:
            por_codigo[cod] = r
            continue
        anterior = por_codigo[cod]
        print(f"[HTML] {cod}: duplicado ('{anterior['nome'].strip()}' e "
              f"'{r['nome'].strip()}') - mantida a linha de Meus Vendidos")
        escolhida = r if r["origem"] == "Meus Vendidos" else anterior
        outra = anterior if escolhida is r else r
        for campo in ("categoria", "subcategoria", "custo"):
            if not escolhida[campo] and outra[campo]:
                escolhida[campo] = outra[campo]
        if "Meus Vendidos" in (anterior["origem"], r["origem"]):
            escolhida["origem"] = "Meus Vendidos"
        por_codigo[cod] = escolhida

    produtos = []
    for cod, r in por_codigo.items():
        custo = float(r["custo"]) if r["custo"] else CUSTOS_FALTANTES.get(cod)
        if custo is None:
            print(f"[HTML] {cod}: sem custo - fora do catalogo")
            continue
        cat, sub = r["categoria"], r["subcategoria"]
        if not cat:
            cat, sub = CATEGORIA_FALTANTE.get(cod, ("OUTROS", ""))
        foto = DIR_FOTOS / f"{cod}.jpg"
        if not foto.exists():
            print(f"[HTML] {cod}: sem foto - fora do catalogo")
            continue
        grupo = grupo_do_produto(cod, sub)
        if grupo is None:
            print(f"[HTML] {cod}: sem grupo de story (sub={sub!r})")
        produtos.append({
            "id": cod, "n": r["nome"].strip().title(), "c": cat, "s": sub,
            "g": slug(grupo) if grupo else "",
            "p": round(custo * MULTIPLICADOR, 2),
            "top": r["origem"] == "Meus Vendidos",
            "img": b64(foto),
        })

    ordem_cats, vistas = [], set()
    for p in produtos:
        if p["c"] not in vistas:
            vistas.add(p["c"])
            ordem_cats.append(p["c"])
    return produtos, ordem_cats


def preparar_icones(produtos: list[dict]) -> list[dict]:
    """Gera (se faltar) o icone recortado de cada grupo de story, usando o
    primeiro produto do grupo como representante."""
    metas = []
    for rotulo, _subs, _cods in GRUPOS:
        s = slug(rotulo)
        itens = [p for p in produtos if p["g"] == s]
        if not itens:
            print(f"[HTML] grupo '{rotulo}' sem produtos - story omitido")
            continue
        icone = DIR_ICONES / f"grupo-{s}.png"
        if not icone.exists():
            gerar_icone(DIR_FOTOS / f"{itens[0]['id']}.jpg", icone)
            print(f"[HTML] icone gerado: {icone.name} (de {itens[0]['id']})")
        metas.append({"rot": rotulo, "slug": s, "n": len(itens), "img": b64(icone)})
    return metas


def montar_html(produtos: list[dict], categorias: list[str], grupos: list[dict]) -> str:
    destaques, usados = [], set()
    for p in produtos:
        if p["top"] and p["id"] not in usados:
            usados.add(p["id"])
            destaques.append(p["id"])
    for cat in categorias:
        primeiro = next((p for p in produtos if p["c"] == cat and p["id"] not in usados), None)
        if primeiro:
            usados.add(primeiro["id"])
            destaques.append(primeiro["id"])
    for p in produtos:
        p["dest"] = p["id"] in destaques

    secoes = [{"nome": c, "rot": ROTULO_SECAO.get(c, c.title()), "slug": slug(c)} for c in categorias]

    dados = json.dumps({"produtos": produtos, "secoes": secoes, "grupos": grupos,
                        "destaques": destaques, "whatsapp": WHATSAPP,
                        "qtdIni": QTD_INICIAL, "passo": QTD_PASSO, "atalhos": list(QTD_ATALHOS)},
                       ensure_ascii=False, separators=(",", ":"))

    banners_html = "".join(
        f'<div class="bslide"><img src="data:image/jpeg;base64,{b64(DIR_BANNERS / b)}" alt=""'
        f'{"" if i == 0 else " loading=\"lazy\""}></div>' for i, b in enumerate(BANNERS))

    beneficios_html = "".join(
        f'<div class="ben"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" '
        f'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">{ICONES[t]}</svg>'
        f'<div><strong>{t}</strong><span>{d}</span></div></div>' for t, d in BENEFICIOS)

    return (TEMPLATE
            .replace("__DADOS__", dados)
            .replace("__LOGO__", b64(LOGO))
            .replace("__MANROPE__", b64(DIR_FONTS / "manrope-latin.woff2"))
            .replace("__CAVEAT__", b64(DIR_FONTS / "caveat-sub.woff2"))
            .replace("__BANNERS__", banners_html)
            .replace("__NBANNERS__", str(len(BANNERS)))
            .replace("__BENEFICIOS__", beneficios_html))


TEMPLATE = r"""<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Catálogo Gift Web Brindes</title>
<meta name="description" content="Catálogo de brindes corporativos personalizados da Gift Web. Monte seu pedido e finalize no WhatsApp.">
<style>
@font-face{font-family:'Manrope';src:url(data:font/woff2;base64,__MANROPE__) format('woff2');font-weight:200 800;font-display:swap}
@font-face{font-family:'CaveatGW';src:url(data:font/woff2;base64,__CAVEAT__) format('woff2');font-weight:500;font-display:swap}
:root{
  --navy-900:#04182b;--navy-800:#07253f;--navy-700:#0b3159;--navy-600:#0f4a80;--navy-500:#1a63a5;
  --green-600:#1b7f1b;--green-500:#2fae2e;--green-400:#54c853;
  --paper:#ffffff;--surface:#ffffff;--line:#e2e9f1;--ink:#0f2438;--ink-2:#3c5165;--muted:#66798e;
  --h:56px;--r:14px;--sh:0 1px 2px rgba(9,36,60,.06),0 4px 14px rgba(9,36,60,.07);
}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{margin:0;padding:0}
body{background:var(--paper);color:var(--ink);
  font:400 15px/1.5 'Manrope',system-ui,-apple-system,'Segoe UI',sans-serif;overflow-x:hidden}
h1,h2,h3{font-family:'Manrope',system-ui,sans-serif;letter-spacing:-.02em}
img{display:block;max-width:100%}
button{font:inherit;cursor:pointer;border:0;background:none;color:inherit}

header{position:fixed;top:0;left:0;right:0;z-index:60;background:var(--navy-800);
  padding:0 12px;padding-top:env(safe-area-inset-top);box-shadow:0 2px 10px rgba(4,24,43,.18)}
.hrow{height:var(--h);display:flex;align-items:center;gap:10px;max-width:1280px;margin:0 auto}
.brand{display:flex;align-items:center;gap:8px;flex:none}
.brand img{width:32px;height:32px;border-radius:50%}
.brand b{color:#fff;font-size:15px;font-weight:800;display:none}
@media(min-width:560px){.brand b{display:block}}
.search{flex:1;position:relative;min-width:0}
.search input{width:100%;height:38px;border-radius:10px;border:0;padding:0 36px 0 12px;
  font-size:14px;font-family:inherit;background:#fff;color:var(--ink);outline:0}
.search input::placeholder{color:var(--muted)}
.search svg{position:absolute;right:11px;top:10px;width:18px;height:18px;color:var(--muted)}
main{padding-top:calc(var(--h) + env(safe-area-inset-top));max-width:1280px;margin:0 auto}

/* BANNER */
.bwrap{position:relative;margin:10px 12px 0;border-radius:var(--r);overflow:hidden;box-shadow:var(--sh)}
.btrack{display:flex;transition:transform .45s cubic-bezier(.4,0,.2,1)}
.bslide{min-width:100%}
.bslide img{width:100%;height:auto;aspect-ratio:1486/1058;object-fit:cover}
.bdots{position:absolute;bottom:9px;left:0;right:0;display:flex;justify-content:center;gap:6px}
.bdots i{width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,.55);transition:.3s;
  box-shadow:0 1px 3px rgba(0,0,0,.3)}
.bdots i.on{background:#fff;width:20px;border-radius:4px}
.barrow{position:absolute;top:50%;transform:translateY(-50%);width:34px;height:34px;border-radius:50%;
  background:rgba(255,255,255,.92);color:var(--navy-700);display:none;place-items:center;box-shadow:var(--sh)}
.barrow.l{left:10px}.barrow.r{right:10px}
@media(min-width:760px){.barrow{display:grid}}
.cursivo{font-family:'CaveatGW',cursive;font-size:clamp(21px,4.6vw,27px);color:var(--muted);
  text-align:right;margin:7px 16px 2px;line-height:1;font-weight:500}

/* STORIES */
.stwrap{position:relative}
.stories{display:flex;gap:10px;overflow-x:auto;padding:20px 12px 10px;scrollbar-width:none;
  scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch}
.stories::-webkit-scrollbar{display:none}
.st{flex:none;width:98px;text-align:center;scroll-snap-align:center;background:none}
.st .circ{position:relative;width:86px;height:86px;margin:0 auto 8px}
.st .circ::before{content:'';position:absolute;inset:0;border-radius:50%;background:#eef2f7;
  transition:background .2s,transform .2s,box-shadow .2s}
.st:active .circ::before{transform:scale(.94)}
.st .circ img{position:absolute;left:50%;top:50%;transform:translate(-50%,-56%);
  width:138%;height:138%;object-fit:contain;
  filter:drop-shadow(0 5px 10px rgba(9,36,60,.18));transition:transform .22s}
.st:active .circ img{transform:translate(-50%,-56%) scale(.95)}
.st span{font-size:11.5px;line-height:1.3;color:var(--ink);font-weight:600;display:block}
.st.on .circ::before{background:#dbe7f5;box-shadow:0 0 0 2.5px var(--green-500)}
.stfade{position:absolute;top:0;bottom:0;right:0;width:34px;pointer-events:none;
  background:linear-gradient(90deg,rgba(255,255,255,0),#fff)}

/* FILTRO ATIVO */
.filtro{display:none;align-items:center;gap:9px;margin:4px 12px 0;padding:9px 12px;
  background:#eef2f7;border-radius:10px;font-size:13px;color:var(--navy-800);font-weight:600}
.filtro.on{display:flex}
.filtro b{font-weight:800}
.filtro button{margin-left:auto;display:flex;align-items:center;gap:5px;color:var(--navy-600);
  font-size:12px;font-weight:700}
.filtro svg{width:13px;height:13px}

section{margin:20px 0 0}
.head{display:flex;align-items:baseline;justify-content:space-between;gap:10px;padding:0 12px 10px}
.head h2{margin:0;font-size:clamp(16px,3.7vw,20px);font-weight:800;color:var(--navy-800)}
.head span{font-size:12px;color:var(--muted);white-space:nowrap}

.carowrap{position:relative}
.caro{display:flex;gap:11px;overflow-x:auto;padding:2px 12px 8px;scroll-snap-type:x mandatory;scrollbar-width:none}
.caro::-webkit-scrollbar{display:none}
.caro .card{flex:0 0 68%;scroll-snap-align:start}
@media(min-width:560px){.caro .card{flex-basis:33%}}
@media(min-width:900px){.caro .card{flex-basis:24%}}
.caroarrow{position:absolute;top:34%;width:36px;height:36px;border-radius:50%;background:#fff;
  color:var(--navy-700);display:none;place-items:center;box-shadow:var(--sh);z-index:5}
.caroarrow.l{left:4px}.caroarrow.r{right:4px}
@media(min-width:900px){.caroarrow{display:grid}}

.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:11px;padding:0 12px}
@media(min-width:640px){.grid{grid-template-columns:repeat(3,1fr)}}
@media(min-width:900px){.grid{grid-template-columns:repeat(4,1fr)}}
@media(min-width:1120px){.grid{grid-template-columns:repeat(5,1fr)}}

.card{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);overflow:hidden;
  display:flex;flex-direction:column;position:relative}
.card .ph{position:relative;aspect-ratio:1;background:#fff;padding:9px}
.card .ph img{width:100%;height:100%;object-fit:contain}
.tag{position:absolute;top:8px;left:8px;background:var(--green-600);color:#fff;font-size:9.5px;
  font-weight:800;letter-spacing:.05em;text-transform:uppercase;padding:3px 7px;border-radius:5px}
.card .info{padding:9px 11px 11px;display:flex;flex-direction:column;flex:1;gap:8px}
.card h3{margin:0;font-size:12.5px;font-weight:500;line-height:1.35;color:var(--ink);
  min-height:2.7em;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.price{display:flex;align-items:baseline;gap:5px;flex-wrap:wrap}
.price small{font-size:10.5px;color:var(--muted);white-space:nowrap}
.price b{font-size:16px;font-weight:800;color:var(--navy-700);letter-spacing:-.02em}
.actions{margin-top:auto;display:flex;flex-direction:column;gap:6px}
.chips{display:flex;gap:5px}
.chips button{flex:1;height:26px;border-radius:7px;background:#f4f7fb;border:1px solid var(--line);
  color:var(--navy-600);font-size:11px;font-weight:700;transition:.15s}
.chips button:active,.chips button.on{background:var(--navy-600);border-color:var(--navy-600);color:#fff}
.qty{display:flex;align-items:center;justify-content:space-between;border:1px solid var(--line);
  border-radius:9px;height:34px;padding:0 2px}
.qty button{width:32px;height:30px;display:grid;place-items:center;color:var(--navy-600);font-size:17px;font-weight:700;border-radius:7px}
.qty button:active{background:#f4f7fb}
.qty .qv{font-size:13.5px;font-weight:700;font-variant-numeric:tabular-nums;min-width:4ch;text-align:center}
.qty .qv i{font-style:normal;font-size:10px;color:var(--muted);font-weight:600}
.add{height:36px;border-radius:9px;background:var(--green-600);color:#fff;font-size:12.5px;font-weight:700;
  display:grid;place-items:center;transition:.15s}
.add:active{transform:scale(.97)}
.add.ok{background:var(--navy-600)}

.benband{margin:24px 12px 0;background:#fff;border:1px solid var(--line);border-radius:var(--r);overflow:hidden}
.benband .bh{background:linear-gradient(100deg,var(--navy-800),var(--navy-600));color:#fff;
  padding:13px 18px;font-weight:800;font-size:13px;letter-spacing:.02em}
.bens{display:grid;grid-template-columns:repeat(2,1fr)}
@media(min-width:800px){.bens{grid-template-columns:repeat(4,1fr)}}
.ben{display:flex;gap:10px;align-items:flex-start;padding:15px 14px;border-top:1px solid var(--line)}
.ben:nth-child(even){border-left:1px solid var(--line)}
@media(min-width:800px){.ben{border-left:1px solid var(--line)}.ben:first-child{border-left:0}}
.ben svg{width:24px;height:24px;flex:none;color:var(--green-600);margin-top:1px}
.ben strong{display:block;font-size:12.5px;font-weight:700;color:var(--navy-800);line-height:1.3;margin-bottom:2px}
.ben span{font-size:11px;color:var(--muted);line-height:1.4}

.fab{position:fixed;right:16px;bottom:calc(16px + env(safe-area-inset-bottom));z-index:65;
  height:56px;padding:0 20px 0 17px;border-radius:30px;background:var(--green-600);color:#fff;
  display:flex;align-items:center;gap:10px;box-shadow:0 6px 22px rgba(27,127,27,.42);
  font-size:14px;font-weight:700;transition:transform .18s}
.fab:active{transform:scale(.95)}
.fab svg{width:23px;height:23px}
.fab .fc{background:#fff;color:var(--green-600);min-width:24px;height:24px;border-radius:12px;
  display:grid;place-items:center;font-size:12.5px;font-weight:800;padding:0 6px}
.fab.zero{padding:0;width:56px;justify-content:center}
.fab.zero .fc,.fab.zero .fl{display:none}

.ov{position:fixed;inset:0;background:rgba(4,24,43,.5);opacity:0;pointer-events:none;transition:.25s;z-index:70;backdrop-filter:blur(2px)}
.ov.on{opacity:1;pointer-events:auto}
.drawer{position:fixed;top:0;right:0;bottom:0;width:min(420px,90vw);background:#f6f8fb;z-index:80;
  transform:translateX(101%);transition:transform .3s cubic-bezier(.4,0,.2,1);display:flex;flex-direction:column;box-shadow:-8px 0 30px rgba(4,24,43,.2)}
.drawer.on{transform:none}
.dh{background:var(--navy-800);color:#fff;padding:16px;padding-top:calc(16px + env(safe-area-inset-top));
  display:flex;align-items:center;justify-content:space-between}
.dh h2{margin:0;font-size:16px;font-weight:800}
.dh button{width:32px;height:32px;display:grid;place-items:center;border-radius:8px;color:#fff}
.ditems{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:9px}
.ci{background:#fff;border:1px solid var(--line);border-radius:11px;padding:9px;display:flex;gap:10px}
.ci img{width:58px;height:58px;object-fit:contain;flex:none;background:#fff;border-radius:7px}
.ci .d{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}
.ci h4{margin:0;font-size:12px;font-weight:600;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.ci .r{display:flex;align-items:center;justify-content:space-between;gap:8px}
.ci .q{display:flex;align-items:center;gap:2px;border:1px solid var(--line);border-radius:7px}
.ci .q button{width:26px;height:26px;display:grid;place-items:center;color:var(--navy-600);font-size:15px}
.ci .q span{font-size:12px;font-weight:700;min-width:3ch;text-align:center;font-variant-numeric:tabular-nums}
.ci .rm{font-size:10.5px;color:#b3261e;text-decoration:underline}
.empty{text-align:center;color:var(--muted);padding:50px 20px;font-size:13.5px}
.empty svg{width:52px;height:52px;color:var(--line);margin:0 auto 12px;display:block}
.df{border-top:1px solid var(--line);background:#fff;padding:14px;padding-bottom:calc(14px + env(safe-area-inset-bottom))}
.resumo{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:11px}
.resumo span{font-size:12.5px;color:var(--ink-2)}
.resumo b{font-size:19px;color:var(--navy-800);font-weight:800}
.wa{width:100%;height:47px;border-radius:11px;background:var(--green-600);color:#fff;font-size:14.5px;
  font-weight:700;display:flex;align-items:center;justify-content:center;gap:9px;text-decoration:none}
.wa:active{transform:scale(.99)}
.wa svg{width:21px;height:21px}
.wa[disabled]{background:var(--line);color:var(--muted);pointer-events:none}
.hint{font-size:10.5px;color:var(--muted);text-align:center;margin:8px 0 0;line-height:1.5}

.ob{position:fixed;inset:0;z-index:95;display:flex;align-items:center;justify-content:center;
  padding:18px;background:rgba(4,24,43,.62);backdrop-filter:blur(3px);opacity:0;pointer-events:none;transition:.3s}
.ob.on{opacity:1;pointer-events:auto}
.obc{background:#fff;border-radius:20px;max-width:400px;width:100%;overflow:hidden;
  box-shadow:0 20px 60px rgba(4,24,43,.4);transform:translateY(14px) scale(.98);transition:.3s;
  max-height:92vh;display:flex;flex-direction:column}
.ob.on .obc{transform:none}
.obh{background:linear-gradient(125deg,var(--navy-800),var(--navy-600));color:#fff;padding:22px 22px 20px;text-align:center}
.obh img{width:52px;height:52px;border-radius:50%;margin:0 auto 11px}
.obh h2{margin:0 0 5px;font-size:19px;font-weight:800}
.obh p{margin:0;font-size:12.5px;opacity:.88;line-height:1.45}
.obb{padding:8px 20px 4px;overflow-y:auto}
.step{display:flex;gap:13px;align-items:flex-start;padding:14px 0;border-bottom:1px solid var(--line)}
.step:last-child{border-bottom:0}
.stepn{flex:none;width:32px;height:32px;border-radius:50%;background:#eef2f7;color:var(--navy-700);
  display:grid;place-items:center;font-weight:800;font-size:14px}
.step .sc{flex:1}
.step h3{margin:0 0 3px;font-size:13.5px;font-weight:700;color:var(--navy-800)}
.step p{margin:0;font-size:12px;color:var(--ink-2);line-height:1.5}
.step .mini{display:inline-flex;align-items:center;gap:4px;background:#eef2f7;border:1px solid var(--line);
  border-radius:6px;padding:2px 7px;font-size:11px;font-weight:700;color:var(--navy-700);margin-top:6px}
.step .mini.g{background:var(--green-600);border-color:var(--green-600);color:#fff}
.step .mini svg{width:13px;height:13px}
.obf{padding:14px 20px 20px}
.obbtn{width:100%;height:48px;border-radius:12px;background:var(--green-600);color:#fff;font-size:15px;font-weight:700}
.obbtn:active{transform:scale(.98)}

.nores{text-align:center;padding:44px 20px;color:var(--muted);font-size:14px;display:none}
footer{text-align:center;padding:30px 20px calc(96px + env(safe-area-inset-bottom));color:var(--muted);
  font-size:11.5px;line-height:1.7;border-top:1px solid var(--line);margin-top:28px}
footer b{color:var(--navy-700);display:block;font-size:13px;margin-bottom:3px;font-weight:800}
.hidden{display:none !important}
.toast{position:fixed;left:50%;bottom:88px;transform:translate(-50%,20px);background:var(--navy-800);color:#fff;
  padding:11px 18px;border-radius:11px;font-size:13px;font-weight:600;opacity:0;pointer-events:none;
  transition:.25s;z-index:90;box-shadow:0 8px 24px rgba(4,24,43,.3)}
.toast.on{opacity:1;transform:translate(-50%,0)}
</style>
</head>
<body>

<header>
  <div class="hrow">
    <div class="brand"><img src="data:image/png;base64,__LOGO__" alt="Gift Web Brindes"><b>Gift Web</b></div>
    <div class="search">
      <input id="q" type="search" placeholder="Buscar brinde..." autocomplete="off">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>
    </div>
  </div>
</header>

<main>
  <div class="bwrap">
    <div class="btrack" id="btrack">__BANNERS__</div>
    <button class="barrow l" id="bprev" aria-label="Anterior"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></button>
    <button class="barrow r" id="bnext" aria-label="Próximo"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></button>
    <div class="bdots" id="bdots"></div>
  </div>

  <div class="stwrap">
    <div class="stories" id="stories"></div>
    <div class="stfade"></div>
  </div>

  <div class="filtro" id="filtro">
    <span>Mostrando <b id="filtroNome"></b></span>
    <button id="limparFiltro"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>limpar</button>
  </div>

  <section id="secDestaques">
    <p class="cursivo">Os Mais Vendidos</p>
    <div class="carowrap">
      <button class="caroarrow l" id="cprev" aria-label="Anterior"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></button>
      <div class="caro" id="caro"></div>
      <button class="caroarrow r" id="cnext" aria-label="Próximo"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></button>
    </div>
  </section>

  <div id="secoes"></div>
  <p class="nores" id="nores">Nenhum produto encontrado.<br>Tente outro termo.</p>

  <footer>
    <b>Gift Web Brindes</b>
    Brindes corporativos personalizados<br>
    Valores sujeitos a confirmação conforme quantidade e personalização.
  </footer>
</main>

<button class="fab zero" id="fab" aria-label="Abrir carrinho">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>
  <span class="fl">Meu pedido</span><span class="fc" id="fabCount">0</span>
</button>

<div class="ov" id="ov"></div>
<aside class="drawer" id="drawer" aria-label="Carrinho">
  <div class="dh">
    <h2>Meu pedido</h2>
    <button id="closeCart" aria-label="Fechar"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
  </div>
  <div class="ditems" id="ditems"></div>
  <div class="df">
    <div class="resumo"><span>Total de itens</span><b id="totItens">0</b></div>
    <a class="wa" id="waBtn" href="#" target="_blank" rel="noopener">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.2-1.7-.9-2-1-.3-.1-.5-.2-.7.1-.2.3-.7 1-.9 1.2-.2.2-.3.2-.6.1-.3-.2-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.5-.5c.1-.2.2-.3.3-.5 0-.2 0-.4-.1-.5l-1-2.2c-.2-.5-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.2-.3-.3-.6-.4M12 2a10 10 0 00-8.6 15L2 22l5.2-1.4A10 10 0 1012 2z"/></svg>
      Finalizar no WhatsApp
    </a>
    <p class="hint">Você recebe o valor conforme a quantidade<br>direto com um consultor</p>
  </div>
</aside>

<div class="ob on" id="ob">
  <div class="obc">
    <div class="obh">
      <img src="data:image/png;base64,__LOGO__" alt="">
      <h2>Como fazer seu pedido</h2>
      <p>São 3 passos rápidos, direto por aqui</p>
    </div>
    <div class="obb">
      <div class="step"><div class="stepn">1</div><div class="sc">
        <h3>Escolha os produtos</h3>
        <p>Role o catálogo, toque nas categorias em destaque no topo ou use a busca para achar o brinde.</p>
      </div></div>
      <div class="step"><div class="stepn">2</div><div class="sc">
        <h3>Defina a quantidade e adicione</h3>
        <p>Use os atalhos de 50 e 100 unidades ou ajuste no + e −. Depois toque em Adicionar.</p>
        <span class="mini g">Adicionar</span>
      </div></div>
      <div class="step"><div class="stepn">3</div><div class="sc">
        <h3>Finalize no WhatsApp</h3>
        <p>Com tudo escolhido, toque no botão verde do pedido no canto da tela e envie sua lista. Um consultor responde com os valores.</p>
        <span class="mini"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>Meu pedido</span>
      </div></div>
    </div>
    <div class="obf"><button class="obbtn" id="obClose">Ver o catálogo</button></div>
  </div>
</div>

<div class="toast" id="toast"></div>

<script>
(function(){
"use strict";
var D = __DADOS__;
var PRODUTOS = D.produtos, SECOES = D.secoes, GRUPOS = D.grupos, DESTAQUES = D.destaques;
var QTD_INI = D.qtdIni, PASSO = D.passo, ATALHOS = D.atalhos;

/* Carrinho: array em memoria. Sem localStorage/sessionStorage - e o valor
   exibido no card e "a partir de", entao o fechamento do preco acontece com
   o consultor no WhatsApp e o carrinho nao guarda preco. */
var carrinho = [];
var grupoAtivo = null;

var $ = function(s){ return document.querySelector(s); };
var brl = function(v){ return 'R$ ' + v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.'); };
var esc = function(s){ return String(s).replace(/[&<>"']/g, function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
var norm = function(t){ return t.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase(); };

function cardHTML(p){
  var chips = ATALHOS.map(function(v){
    return '<button data-act="set" data-v="'+v+'">'+v+' un</button>'; }).join('');
  return '<article class="card" data-id="'+p.id+'" data-g="'+p.g+'" data-busca="'+esc(norm(p.n+' '+p.c+' '+p.s+' '+p.id))+'">'
    + '<div class="ph">' + (p.dest ? '<span class="tag">Mais vendido</span>' : '')
    + '<img src="data:image/jpeg;base64,'+p.img+'" alt="'+esc(p.n)+'" loading="lazy"></div>'
    + '<div class="info"><h3>'+esc(p.n)+'</h3>'
    + '<div class="price"><small>A partir de</small><b>'+brl(p.p)+'</b></div>'
    + '<div class="actions"><div class="chips">'+chips+'</div>'
    + '<div class="qty"><button data-act="dec" aria-label="Menos">&minus;</button>'
    + '<span class="qv">'+QTD_INI+' <i>un</i></span>'
    + '<button data-act="inc" aria-label="Mais">+</button></div>'
    + '<button class="add" data-act="add">Adicionar</button>'
    + '</div></div></article>';
}
function lerQtd(card){ return parseInt(card.querySelector('.qv').textContent, 10) || QTD_INI; }
function escreverQtd(card, v){
  card.querySelector('.qv').innerHTML = v + ' <i>un</i>';
  card.querySelectorAll('.chips button').forEach(function(b){
    b.classList.toggle('on', parseInt(b.dataset.v, 10) === v); });
}

function montar(){
  $('#caro').innerHTML = DESTAQUES.map(function(id){
    var p = PRODUTOS.find(function(x){ return x.id === id; });
    return p ? cardHTML(p) : ''; }).join('');

  $('#stories').innerHTML = GRUPOS.map(function(g){
    return '<button class="st" data-g="'+g.slug+'">'
      + '<div class="circ"><img src="data:image/png;base64,'+g.img+'" alt=""></div>'
      + '<span>'+esc(g.rot)+'</span></button>'; }).join('');

  var html = '';
  SECOES.forEach(function(s, i){
    var itens = PRODUTOS.filter(function(p){ return p.c === s.nome; });
    html += '<section class="catsec" id="cat-'+s.slug+'">'
      + '<div class="head"><h2>'+esc(s.rot)+'</h2><span class="cnt">'+itens.length+' itens</span></div>'
      + '<div class="grid">'+itens.map(cardHTML).join('')+'</div></section>';
    if(i % 3 === 2 && i < SECOES.length - 1) html += bandaHTML();
  });
  $('#secoes').innerHTML = html + bandaHTML();
}
function bandaHTML(){
  return '<div class="benband"><div class="bh">POR QUE COMPRAR NA GIFT WEB</div>'
    + '<div class="bens">__BENEFICIOS__</div></div>';
}

/* ---------- CARRINHO ---------- */
function addItem(id, qtd){
  var p = PRODUTOS.find(function(x){ return x.id === id; });
  if(!p) return;
  var it = carrinho.find(function(x){ return x.id === id; });
  if(it) it.q += qtd; else carrinho.push({ id:p.id, n:p.n, img:p.img, q:qtd });
  renderCarrinho();
  toast(qtd + ' unidades adicionadas');
}
function setQtd(id, q){
  var it = carrinho.find(function(x){ return x.id === id; });
  if(!it) return;
  it.q = q;
  if(it.q < 1) carrinho = carrinho.filter(function(x){ return x.id !== id; });
  renderCarrinho();
}
function removeItem(id){
  carrinho = carrinho.filter(function(x){ return x.id !== id; });
  renderCarrinho();
}
function renderCarrinho(){
  var n = carrinho.reduce(function(s,i){ return s + i.q; }, 0);
  $('#fabCount').textContent = n;
  $('#fab').classList.toggle('zero', carrinho.length === 0);
  $('#totItens').textContent = n + (n === 1 ? ' unidade' : ' unidades');

  var box = $('#ditems');
  if(!carrinho.length){
    box.innerHTML = '<div class="empty">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>'
      + 'Seu pedido está vazio.<br>Adicione produtos do catálogo.</div>';
  } else {
    box.innerHTML = carrinho.map(function(i){
      return '<div class="ci" data-id="'+i.id+'"><img src="data:image/jpeg;base64,'+i.img+'" alt="">'
        + '<div class="d"><h4>'+esc(i.n)+'</h4><div class="r"><div class="q">'
        + '<button data-cact="dec" aria-label="Menos">&minus;</button><span>'+i.q+'</span>'
        + '<button data-cact="inc" aria-label="Mais">+</button></div>'
        + '<button class="rm" data-cact="rm">remover</button></div></div></div>';
    }).join('');
  }

  var wa = $('#waBtn');
  if(!carrinho.length){ wa.setAttribute('disabled',''); wa.href = '#'; }
  else {
    wa.removeAttribute('disabled');
    var linhas = carrinho.map(function(i){ return '- ' + i.n + ' (cod ' + i.id + ') | ' + i.q + ' un'; });
    var msg = 'Olá! Tenho interesse nestes brindes:\n\n' + linhas.join('\n')
      + '\n\nTotal: ' + n + ' unidades.\nPoderia me passar o valor?';
    wa.href = 'https://wa.me/' + D.whatsapp + '?text=' + encodeURIComponent(msg);
  }
}

var tmr;
function toast(msg){
  var t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(tmr); tmr = setTimeout(function(){ t.classList.remove('on'); }, 1900);
}
function abrirCarrinho(v){
  $('#drawer').classList.toggle('on', v);
  $('#ov').classList.toggle('on', v);
  document.body.style.overflow = v ? 'hidden' : '';
}

/* ---------- FILTRO (busca + grupo do story) ---------- */
function aplicarFiltro(){
  var t = norm($('#q').value.trim()), achou = 0;
  document.querySelectorAll('.catsec').forEach(function(sec){
    var vis = 0;
    sec.querySelectorAll('.card').forEach(function(c){
      var ok = (!t || c.dataset.busca.indexOf(t) > -1)
            && (!grupoAtivo || c.dataset.g === grupoAtivo);
      c.classList.toggle('hidden', !ok);
      if(ok) vis++;
    });
    sec.classList.toggle('hidden', vis === 0);
    var cnt = sec.querySelector('.cnt');
    if(cnt) cnt.textContent = vis + (vis === 1 ? ' item' : ' itens');
    achou += vis;
  });
  var filtrando = !!t || !!grupoAtivo;
  $('#secDestaques').classList.toggle('hidden', filtrando);
  $('.stwrap').classList.toggle('hidden', !!t);
  document.querySelectorAll('.benband').forEach(function(b){ b.classList.toggle('hidden', filtrando); });
  $('#nores').style.display = (filtrando && achou === 0) ? 'block' : 'none';

  var f = $('#filtro');
  if(grupoAtivo && !t){
    var g = GRUPOS.find(function(x){ return x.slug === grupoAtivo; });
    $('#filtroNome').textContent = g ? g.rot : '';
    f.classList.add('on');
  } else f.classList.remove('on');
}
function selecionarGrupo(s){
  grupoAtivo = (grupoAtivo === s) ? null : s;
  document.querySelectorAll('.st').forEach(function(x){
    x.classList.toggle('on', x.dataset.g === grupoAtivo); });
  $('#q').value = '';
  aplicarFiltro();
  var y = $('.stwrap').getBoundingClientRect().bottom + window.pageYOffset - 60;
  window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
}

/* ---------- EVENTOS ---------- */
document.addEventListener('click', function(e){
  var b = e.target.closest('[data-act]');
  if(b){
    var card = b.closest('.card'), act = b.dataset.act, q = lerQtd(card);
    if(act === 'inc') escreverQtd(card, q + PASSO);
    else if(act === 'dec') escreverQtd(card, Math.max(QTD_INI, q - PASSO));
    else if(act === 'set') escreverQtd(card, parseInt(b.dataset.v, 10));
    else if(act === 'add'){
      addItem(card.dataset.id, q);
      escreverQtd(card, QTD_INI);
      b.textContent = 'Adicionado ✓'; b.classList.add('ok');
      setTimeout(function(){ b.textContent = 'Adicionar'; b.classList.remove('ok'); }, 1200);
    }
    return;
  }
  var c = e.target.closest('[data-cact]');
  if(c){
    var id = c.closest('.ci').dataset.id;
    var cur = carrinho.find(function(x){ return x.id === id; });
    if(!cur) return;
    if(c.dataset.cact === 'inc') setQtd(id, cur.q + PASSO);
    else if(c.dataset.cact === 'dec') setQtd(id, cur.q - PASSO);
    else removeItem(id);
    return;
  }
  var s = e.target.closest('.st');
  if(s) selecionarGrupo(s.dataset.g);
});
$('#limparFiltro').addEventListener('click', function(){
  grupoAtivo = null;
  document.querySelectorAll('.st').forEach(function(x){ x.classList.remove('on'); });
  aplicarFiltro();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
$('#fab').addEventListener('click', function(){ abrirCarrinho(true); });
$('#closeCart').addEventListener('click', function(){ abrirCarrinho(false); });
$('#ov').addEventListener('click', function(){ abrirCarrinho(false); });
document.addEventListener('keydown', function(e){
  if(e.key === 'Escape'){ abrirCarrinho(false); fecharOb(); } });

function fecharOb(){ $('#ob').classList.remove('on'); document.body.style.overflow = ''; }
$('#obClose').addEventListener('click', fecharOb);
$('#ob').addEventListener('click', function(e){ if(e.target === this) fecharOb(); });
document.body.style.overflow = 'hidden';

var dt;
$('#q').addEventListener('input', function(){
  clearTimeout(dt);
  dt = setTimeout(function(){
    if($('#q').value.trim()){
      grupoAtivo = null;
      document.querySelectorAll('.st').forEach(function(x){ x.classList.remove('on'); });
    }
    aplicarFiltro();
  }, 130);
});

/* ---------- BANNER ---------- */
var bi = 0, nb = __NBANNERS__, dots = $('#bdots');
dots.innerHTML = Array.from({length: nb}, function(_, k){
  return '<i class="'+(k === 0 ? 'on' : '')+'"></i>'; }).join('');
function goB(i){
  bi = (i + nb) % nb;
  $('#btrack').style.transform = 'translateX(' + (-bi * 100) + '%)';
  dots.querySelectorAll('i').forEach(function(d, k){ d.classList.toggle('on', k === bi); });
}
$('#bnext').addEventListener('click', function(){ goB(bi + 1); reiniciar(); });
$('#bprev').addEventListener('click', function(){ goB(bi - 1); reiniciar(); });
dots.addEventListener('click', function(e){
  var i = [].indexOf.call(dots.children, e.target);
  if(i > -1){ goB(i); reiniciar(); } });
var auto = setInterval(function(){ goB(bi + 1); }, 5500);
function reiniciar(){ clearInterval(auto); auto = setInterval(function(){ goB(bi + 1); }, 5500); }

$('#cnext').addEventListener('click', function(){
  var c = $('#caro'); c.scrollBy({ left: c.clientWidth * 0.8, behavior: 'smooth' }); });
$('#cprev').addEventListener('click', function(){
  var c = $('#caro'); c.scrollBy({ left: -c.clientWidth * 0.8, behavior: 'smooth' }); });

/* dica de rolagem nos stories */
function dicaStories(){
  var s = $('#stories');
  if(s.scrollWidth <= s.clientWidth + 8) return;
  setTimeout(function(){
    s.scrollTo({ left: 72, behavior: 'smooth' });
    setTimeout(function(){ s.scrollTo({ left: 0, behavior: 'smooth' }); }, 640);
  }, 800);
}

montar();
renderCarrinho();
dicaStories();
})();
</script>
</body>
</html>
"""


def main():
    produtos, categorias = carregar_produtos()
    grupos = preparar_icones(produtos)
    print(f"[HTML] {len(produtos)} produtos, {len(categorias)} secoes, {len(grupos)} stories")
    html = montar_html(produtos, categorias, grupos)
    OUT.write_text(html, encoding="utf-8")
    # copia para public/ para ir junto com o deploy do site: o visualizador de
    # documentos do WhatsApp NAO executa JavaScript, entao o cliente precisa
    # receber um LINK, nao o arquivo como anexo.
    PUBLICO.write_text(html, encoding="utf-8")
    print(f"[HTML] Gerado {OUT} ({OUT.stat().st_size / 1024 / 1024:.2f} MB)")
    print(f"[HTML] Copiado para {PUBLICO} -> https://www.giftwebbrindes.com.br/catalogo.html")


if __name__ == "__main__":
    main()
