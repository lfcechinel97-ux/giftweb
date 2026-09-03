#!/usr/bin/env python
"""Gera o catalogo B2B em HTML unico e autocontido (base64 embutido).

Sem link externo, sem hospedagem, sem servidor: o arquivo abre direto do
sistema de arquivos (file://) no celular do cliente. Unico ponto que sai do
arquivo e o botao "Finalizar no WhatsApp", que e o fim do fluxo.
"""
from __future__ import annotations

import base64
import csv
import json
import re
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
CSV_IN = RAIZ / "output" / "catalogo_html_produtos.csv"
DIR_MOCKUPS = RAIZ / "data" / "mockups"
DIR_FONTS = RAIZ / "data" / "fonts"
LOGO = RAIZ / "public" / "logos" / "giftweb-logo.png"
OUT = RAIZ / "output" / "catalogo-giftweb.html"

WHATSAPP = "5548996652844"
MULTIPLICADOR = 2.5

# Custos ausentes no CSV, recuperados de products_cache (API XBZ).
# 14794 tem variantes com custos diferentes (17.60 e 26.00) - usado o mais comum.
CUSTOS_FALTANTES = {"14794": 17.60, "06033": 36.90}

# Os 4 produtos de "Meus Vendidos" nao tem categoria no CSV - encaixados na
# categoria coerente para nao criarem uma secao orfa.
CATEGORIA_FALTANTE = {
    "14794": ("COPOS, GARRAFAS E CANECAS", "Garrafas Térmicas / Squeezes"),
    "06033": ("COPOS, GARRAFAS E CANECAS", "Garrafas Térmicas / Squeezes"),
    "01318": ("MOCHILAS, BOLSAS TÉRMICAS E MALAS", "Mochilas e Sacochilas"),
    "18921": ("COPOS, GARRAFAS E CANECAS", "Garrafas Térmicas / Squeezes"),
}

BENEFICIOS = [
    ("Personalização inclusa", "Arte e gravação já no valor do produto"),
    ("Entrega para todo o Brasil", "Envio para qualquer cidade, com prazo confirmado"),
    ("Atendimento consultivo", "A gente ajuda a escolher o brinde certo"),
    ("Pedido a partir de 20 un.", "Quantidade mínima acessível para começar"),
]

ICONES = {
    "Personalização inclusa": '<path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/>',
    "Entrega para todo o Brasil": '<rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
    "Atendimento consultivo": '<path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/>',
    "Pedido a partir de 20 un.": '<path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>',
}


def b64(caminho: Path) -> str:
    return base64.b64encode(caminho.read_bytes()).decode("ascii")


def preco_fmt(valor: float) -> str:
    return f"{valor:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def slug(txt: str) -> str:
    import unicodedata
    n = unicodedata.normalize("NFD", txt.lower())
    n = "".join(c for c in n if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", "-", n).strip("-")


def carregar_produtos() -> tuple[list[dict], list[str]]:
    with open(CSV_IN, encoding="utf-8-sig") as f:
        linhas = list(csv.DictReader(f))

    produtos = []
    for r in linhas:
        cod = r["codigo"]
        custo = float(r["custo"]) if r["custo"] else CUSTOS_FALTANTES.get(cod)
        if custo is None:
            print(f"[HTML] {cod}: sem custo - fora do catalogo")
            continue
        cat, sub = r["categoria"], r["subcategoria"]
        if not cat:
            cat, sub = CATEGORIA_FALTANTE.get(cod, ("OUTROS", ""))
        foto = DIR_MOCKUPS / f"{cod}.jpg"
        if not foto.exists():
            print(f"[HTML] {cod}: sem mockup - fora do catalogo")
            continue
        produtos.append({
            "id": cod,
            "n": r["nome"].strip().title(),
            "c": cat,
            "s": sub,
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


def montar_html(produtos: list[dict], categorias: list[str]) -> str:
    # destaques: os "Meus Vendidos" + o primeiro de cada categoria (ordem do CSV
    # preserva o ranking da XBZ) -> variedade ao rolar, nao 6 do mesmo tipo
    destaques, usados = [], set()
    for p in produtos:
        if p["top"] and p["id"] not in usados:
            usados.add(p["id"]); destaques.append(p["id"])
    for cat in categorias:
        primeiro = next((p for p in produtos if p["c"] == cat and p["id"] not in usados), None)
        if primeiro:
            usados.add(primeiro["id"]); destaques.append(primeiro["id"])
    for p in produtos:
        p["dest"] = p["id"] in destaques

    cats_meta = [{"nome": c, "slug": slug(c),
                  "img": next(p["img"] for p in produtos if p["c"] == c)} for c in categorias]

    dados = json.dumps({"produtos": produtos, "categorias": cats_meta,
                        "destaques": destaques, "whatsapp": WHATSAPP},
                       ensure_ascii=False, separators=(",", ":"))

    logo_b64 = b64(LOGO)
    inter_b64 = b64(DIR_FONTS / "inter-latin.woff2")
    sora_b64 = b64(DIR_FONTS / "sora-latin.woff2")

    beneficios_html = "".join(
        f'<div class="ben"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" '
        f'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">{ICONES[t]}</svg>'
        f'<div><strong>{t}</strong><span>{d}</span></div></div>'
        for t, d in BENEFICIOS)

    return TEMPLATE.replace("__DADOS__", dados) \
                   .replace("__LOGO__", logo_b64) \
                   .replace("__INTER__", inter_b64) \
                   .replace("__SORA__", sora_b64) \
                   .replace("__BENEFICIOS__", beneficios_html)


TEMPLATE = r"""<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Catálogo Gift Web Brindes</title>
<style>
@font-face{font-family:'Inter';src:url(data:font/woff2;base64,__INTER__) format('woff2');font-weight:100 900;font-display:swap}
@font-face{font-family:'Sora';src:url(data:font/woff2;base64,__SORA__) format('woff2');font-weight:100 900;font-display:swap}
:root{
  --navy-900:#04182b;--navy-800:#07253f;--navy-700:#0b3159;--navy-600:#0f4a80;--navy-500:#1a63a5;
  --green-600:#1b7f1b;--green-500:#2fae2e;--green-400:#54c853;
  --paper:#eef2f7;--surface:#fff;--line:#e2e9f1;--ink:#0f2438;--ink-2:#3c5165;--muted:#66798e;
  --h:58px;--r:14px;--sh:0 1px 3px rgba(9,36,60,.08),0 6px 18px rgba(9,36,60,.06);
}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{margin:0;padding:0}
body{background:var(--paper);color:var(--ink);font:400 15px/1.5 'Inter',system-ui,-apple-system,'Segoe UI',sans-serif;overflow-x:hidden}
h1,h2,h3,.ff{font-family:'Sora','Inter',system-ui,sans-serif;letter-spacing:-.02em}
img{display:block;max-width:100%}
button{font:inherit;cursor:pointer;border:0;background:none;color:inherit}

/* HEADER */
header{position:fixed;top:0;left:0;right:0;z-index:60;background:var(--navy-800);
  padding:0 12px;padding-top:env(safe-area-inset-top);box-shadow:0 2px 10px rgba(4,24,43,.18)}
.hrow{height:var(--h);display:flex;align-items:center;gap:10px;max-width:1280px;margin:0 auto}
.brand{display:flex;align-items:center;gap:8px;flex:none}
.brand img{width:34px;height:34px;border-radius:50%}
.brand b{color:#fff;font-family:'Sora',sans-serif;font-size:15px;font-weight:700;display:none}
@media(min-width:600px){.brand b{display:block}}
.search{flex:1;position:relative;min-width:0}
.search input{width:100%;height:38px;border-radius:10px;border:0;padding:0 36px 0 12px;
  font-size:14px;background:#fff;color:var(--ink);outline:0}
.search input::placeholder{color:var(--muted)}
.search svg{position:absolute;right:11px;top:10px;width:18px;height:18px;color:var(--muted)}
.cartbtn{position:relative;flex:none;width:42px;height:42px;display:grid;place-items:center;
  border-radius:10px;color:#fff}
.cartbtn:active{background:rgba(255,255,255,.12)}
.cartbtn svg{width:23px;height:23px}
.badge{position:absolute;top:2px;right:1px;min-width:19px;height:19px;padding:0 5px;border-radius:10px;
  background:var(--green-500);color:#fff;font-size:11px;font-weight:700;display:grid;place-items:center;
  border:2px solid var(--navy-800)}
main{padding-top:calc(var(--h) + env(safe-area-inset-top));max-width:1280px;margin:0 auto}

/* BANNER */
.bwrap{position:relative;margin:10px 12px 0;border-radius:var(--r);overflow:hidden;box-shadow:var(--sh)}
.btrack{display:flex;transition:transform .45s cubic-bezier(.4,0,.2,1)}
.bslide{min-width:100%;padding:26px 22px;color:#fff;background:linear-gradient(120deg,var(--navy-700),var(--navy-500))}
.bslide.b2{background:linear-gradient(120deg,var(--green-600),#137a4a)}
.bslide h2{margin:0 0 6px;font-size:clamp(19px,4.6vw,30px);font-weight:700;line-height:1.15}
.bslide p{margin:0;opacity:.92;font-size:clamp(13px,3vw,15px);max-width:46ch}
.bdots{position:absolute;bottom:10px;left:0;right:0;display:flex;justify-content:center;gap:6px}
.bdots i{width:7px;height:7px;border-radius:50%;background:rgba(255,255,255,.45);transition:.3s}
.bdots i.on{background:#fff;width:20px;border-radius:4px}
.barrow{position:absolute;top:50%;transform:translateY(-50%);width:34px;height:34px;border-radius:50%;
  background:rgba(255,255,255,.9);color:var(--navy-700);display:none;place-items:center;box-shadow:var(--sh)}
.barrow.l{left:10px}.barrow.r{right:10px}
@media(min-width:760px){.barrow{display:grid}}

/* STORIES */
.stories{display:flex;gap:14px;overflow-x:auto;padding:16px 12px 6px;scrollbar-width:none;scroll-snap-type:x proximity}
.stories::-webkit-scrollbar{display:none}
.st{flex:none;width:74px;text-align:center;scroll-snap-align:start}
.st .ring{width:66px;height:66px;border-radius:50%;padding:2.5px;margin:0 auto 6px;
  background:linear-gradient(135deg,var(--navy-500),var(--green-500));transition:transform .2s}
.st:active .ring{transform:scale(.94)}
.st .ring div{width:100%;height:100%;border-radius:50%;background:#fff;overflow:hidden;padding:5px}
.st img{width:100%;height:100%;object-fit:contain}
.st span{font-size:10.5px;line-height:1.25;color:var(--ink-2);font-weight:500;display:block}

/* SECOES */
section{margin:22px 0 0}
.head{display:flex;align-items:baseline;justify-content:space-between;gap:10px;padding:0 12px 10px}
.head h2{margin:0;font-size:clamp(16px,3.7vw,21px);font-weight:700;color:var(--navy-800)}
.head span{font-size:12px;color:var(--muted);white-space:nowrap}

/* CARROSSEL DESTAQUES */
.carowrap{position:relative}
.caro{display:flex;gap:11px;overflow-x:auto;padding:2px 12px 8px;scroll-snap-type:x mandatory;scrollbar-width:none}
.caro::-webkit-scrollbar{display:none}
.caro .card{flex:0 0 66%;scroll-snap-align:start}
@media(min-width:560px){.caro .card{flex-basis:32%}}
@media(min-width:900px){.caro .card{flex-basis:23.5%}}
.caroarrow{position:absolute;top:38%;width:36px;height:36px;border-radius:50%;background:#fff;
  color:var(--navy-700);display:none;place-items:center;box-shadow:var(--sh);z-index:5}
.caroarrow.l{left:4px}.caroarrow.r{right:4px}
@media(min-width:900px){.caroarrow{display:grid}}

/* GRID */
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:11px;padding:0 12px}
@media(min-width:640px){.grid{grid-template-columns:repeat(3,1fr)}}
@media(min-width:900px){.grid{grid-template-columns:repeat(4,1fr)}}
@media(min-width:1120px){.grid{grid-template-columns:repeat(5,1fr)}}

/* CARD */
.card{background:var(--surface);border-radius:var(--r);box-shadow:var(--sh);overflow:hidden;
  display:flex;flex-direction:column;position:relative}
.card .ph{position:relative;aspect-ratio:1;background:#fff;padding:9px}
.card .ph img{width:100%;height:100%;object-fit:contain}
.tag{position:absolute;top:8px;left:8px;background:var(--green-600);color:#fff;font-size:9.5px;
  font-weight:700;letter-spacing:.05em;text-transform:uppercase;padding:3px 7px;border-radius:5px}
.card .info{padding:9px 11px 11px;display:flex;flex-direction:column;flex:1;gap:7px}
.card h3{margin:0;font-family:'Inter',sans-serif;font-size:12.5px;font-weight:500;line-height:1.35;
  color:var(--ink);min-height:2.7em;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.price small{display:block;font-size:10px;color:var(--muted);margin-bottom:1px}
.price b{font-family:'Sora',sans-serif;font-size:16.5px;font-weight:700;color:var(--navy-700);letter-spacing:-.02em}
.actions{margin-top:auto;display:flex;flex-direction:column;gap:6px}
.qty{display:flex;align-items:center;justify-content:space-between;border:1px solid var(--line);
  border-radius:9px;height:34px;padding:0 2px}
.qty button{width:30px;height:30px;display:grid;place-items:center;color:var(--navy-600);font-size:17px;font-weight:600;border-radius:7px}
.qty button:active{background:var(--paper)}
.qty span{font-size:13.5px;font-weight:600;font-variant-numeric:tabular-nums;min-width:2ch;text-align:center}
.add{height:36px;border-radius:9px;background:var(--green-600);color:#fff;font-size:12.5px;font-weight:600;
  display:grid;place-items:center;transition:.15s}
.add:active{transform:scale(.97)}
.add.ok{background:var(--navy-600)}

/* BENEFICIOS */
.benband{margin:24px 12px 0;background:var(--surface);border-radius:var(--r);box-shadow:var(--sh);overflow:hidden}
.benband .bh{background:linear-gradient(100deg,var(--navy-800),var(--navy-600));color:#fff;
  padding:13px 18px;font-family:'Sora',sans-serif;font-weight:700;font-size:13px;letter-spacing:.02em}
.bens{display:grid;grid-template-columns:repeat(2,1fr)}
@media(min-width:800px){.bens{grid-template-columns:repeat(4,1fr)}}
.ben{display:flex;gap:10px;align-items:flex-start;padding:15px 14px;border-top:1px solid var(--line)}
.ben:nth-child(even){border-left:1px solid var(--line)}
@media(min-width:800px){.ben{border-left:1px solid var(--line)}.ben:first-child{border-left:0}}
.ben svg{width:24px;height:24px;flex:none;color:var(--green-600);margin-top:1px}
.ben strong{display:block;font-size:12.5px;font-weight:600;color:var(--navy-800);line-height:1.3;margin-bottom:2px}
.ben span{font-size:11px;color:var(--muted);line-height:1.4}

/* CARRINHO */
.ov{position:fixed;inset:0;background:rgba(4,24,43,.5);opacity:0;pointer-events:none;transition:.25s;z-index:70;backdrop-filter:blur(2px)}
.ov.on{opacity:1;pointer-events:auto}
.drawer{position:fixed;top:0;right:0;bottom:0;width:min(420px,90vw);background:var(--paper);z-index:80;
  transform:translateX(101%);transition:transform .3s cubic-bezier(.4,0,.2,1);display:flex;flex-direction:column;box-shadow:-8px 0 30px rgba(4,24,43,.2)}
.drawer.on{transform:none}
.dh{background:var(--navy-800);color:#fff;padding:16px;padding-top:calc(16px + env(safe-area-inset-top));
  display:flex;align-items:center;justify-content:space-between}
.dh h2{margin:0;font-size:16px;font-weight:700}
.dh button{width:32px;height:32px;display:grid;place-items:center;border-radius:8px;color:#fff}
.ditems{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:9px}
.ci{background:#fff;border-radius:11px;padding:9px;display:flex;gap:10px;box-shadow:var(--sh)}
.ci img{width:56px;height:56px;object-fit:contain;flex:none;background:#fff;border-radius:7px}
.ci .d{flex:1;min-width:0;display:flex;flex-direction:column;gap:5px}
.ci h4{margin:0;font-size:12px;font-weight:500;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.ci .r{display:flex;align-items:center;justify-content:space-between;gap:8px}
.ci .q{display:flex;align-items:center;gap:2px;border:1px solid var(--line);border-radius:7px}
.ci .q button{width:25px;height:25px;display:grid;place-items:center;color:var(--navy-600);font-size:15px}
.ci .q span{font-size:12px;font-weight:600;min-width:2ch;text-align:center;font-variant-numeric:tabular-nums}
.ci b{font-family:'Sora',sans-serif;font-size:13px;color:var(--navy-700)}
.ci .rm{font-size:10.5px;color:#b3261e;text-decoration:underline;align-self:flex-start}
.empty{text-align:center;color:var(--muted);padding:50px 20px;font-size:13.5px}
.empty svg{width:52px;height:52px;color:var(--line);margin:0 auto 12px;display:block}
.df{border-top:1px solid var(--line);background:#fff;padding:14px;padding-bottom:calc(14px + env(safe-area-inset-bottom))}
.tot{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:11px}
.tot span{font-size:12.5px;color:var(--ink-2)}
.tot b{font-family:'Sora',sans-serif;font-size:21px;color:var(--navy-800);font-weight:700}
.wa{width:100%;height:47px;border-radius:11px;background:var(--green-600);color:#fff;font-size:14.5px;
  font-weight:600;display:flex;align-items:center;justify-content:center;gap:9px;text-decoration:none}
.wa:active{transform:scale(.99)}
.wa svg{width:21px;height:21px}
.wa[disabled]{background:var(--line);color:var(--muted);pointer-events:none}
.hint{font-size:10.5px;color:var(--muted);text-align:center;margin:8px 0 0}

.nores{text-align:center;padding:44px 20px;color:var(--muted);font-size:14px;display:none}
footer{text-align:center;padding:30px 20px calc(34px + env(safe-area-inset-bottom));color:var(--muted);font-size:11.5px;line-height:1.7}
footer b{color:var(--navy-700);font-family:'Sora',sans-serif;display:block;font-size:13px;margin-bottom:3px}
.hidden{display:none !important}
.toast{position:fixed;left:50%;bottom:24px;transform:translate(-50%,20px);background:var(--navy-800);color:#fff;
  padding:11px 18px;border-radius:11px;font-size:13px;font-weight:500;opacity:0;pointer-events:none;
  transition:.25s;z-index:90;box-shadow:0 8px 24px rgba(4,24,43,.3)}
.toast.on{opacity:1;transform:translate(-50%,0)}
</style>
</head>
<body>

<header>
  <div class="hrow">
    <div class="brand">
      <img src="data:image/png;base64,__LOGO__" alt="Gift Web Brindes">
      <b>Gift Web</b>
    </div>
    <div class="search">
      <input id="q" type="search" placeholder="Buscar brinde..." autocomplete="off">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>
    </div>
    <button class="cartbtn" id="openCart" aria-label="Abrir carrinho">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>
      <span class="badge hidden" id="cartCount">0</span>
    </button>
  </div>
</header>

<main>
  <div class="bwrap">
    <div class="btrack" id="btrack">
      <div class="bslide">
        <h2>Brindes personalizados<br>com a marca da sua empresa</h2>
        <p>Gravação inclusa, catálogo com mais de 100 produtos e entrega para todo o Brasil.</p>
      </div>
      <div class="bslide b2">
        <h2>Peça a partir de 20 unidades</h2>
        <p>Monte seu carrinho e finalize direto no WhatsApp com um consultor.</p>
      </div>
    </div>
    <button class="barrow l" id="bprev" aria-label="Anterior"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg></button>
    <button class="barrow r" id="bnext" aria-label="Próximo"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></button>
    <div class="bdots" id="bdots"></div>
  </div>

  <div class="stories" id="stories"></div>

  <section id="secDestaques">
    <div class="head"><h2>Mais vendidos</h2><span>arraste →</span></div>
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

<div class="ov" id="ov"></div>
<aside class="drawer" id="drawer" aria-label="Carrinho">
  <div class="dh">
    <h2>Seu orçamento</h2>
    <button id="closeCart" aria-label="Fechar"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
  </div>
  <div class="ditems" id="ditems"></div>
  <div class="df">
    <div class="tot"><span>Total estimado</span><b id="total">R$ 0,00</b></div>
    <a class="wa" id="waBtn" href="#" target="_blank" rel="noopener">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4c-.3-.2-1.7-.9-2-1-.3-.1-.5-.2-.7.1-.2.3-.7 1-.9 1.2-.2.2-.3.2-.6.1-.3-.2-1.2-.5-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.5-.5c.1-.2.2-.3.3-.5 0-.2 0-.4-.1-.5l-1-2.2c-.2-.5-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.2-.3-.3-.6-.4M12 2a10 10 0 00-8.6 15L2 22l5.2-1.4A10 10 0 1012 2z"/></svg>
      Finalizar no WhatsApp
    </a>
    <p class="hint">Você fala com um consultor para fechar o pedido</p>
  </div>
</aside>
<div class="toast" id="toast"></div>

<script>
(function(){
"use strict";
var D = __DADOS__;
var PRODUTOS = D.produtos, CATEGORIAS = D.categorias, DESTAQUES = D.destaques;

/* Carrinho: array em memoria. Sem localStorage/sessionStorage de proposito -
   este arquivo abre via file:// e alguns navegadores zeram/bloqueiam storage
   nesse contexto. Fechou a aba, carrinho zera - comportamento aceito. */
var carrinho = [];

var $ = function(s){ return document.querySelector(s); };
var brl = function(v){ return 'R$ ' + v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.'); };
var esc = function(s){ return String(s).replace(/[&<>"']/g, function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
var slug = function(t){ return t.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); };
var norm = function(t){ return t.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase(); };

/* ---------- CARDS ---------- */
function cardHTML(p){
  return '<article class="card" data-id="'+p.id+'" data-busca="'+esc(norm(p.n+' '+p.c+' '+p.s+' '+p.id))+'">'
    + '<div class="ph">' + (p.dest ? '<span class="tag">Mais vendido</span>' : '')
    + '<img src="data:image/jpeg;base64,'+p.img+'" alt="'+esc(p.n)+'" loading="lazy"></div>'
    + '<div class="info"><h3>'+esc(p.n)+'</h3>'
    + '<div class="price"><small>A partir de</small><b>'+brl(p.p)+'</b></div>'
    + '<div class="actions">'
    + '<div class="qty"><button data-act="dec" aria-label="Menos">&minus;</button>'
    + '<span class="qv">1</span>'
    + '<button data-act="inc" aria-label="Mais">+</button></div>'
    + '<button class="add" data-act="add">Adicionar</button>'
    + '</div></div></article>';
}

/* ---------- RENDER ---------- */
function montar(){
  var caro = $('#caro');
  caro.innerHTML = DESTAQUES.map(function(id){
    var p = PRODUTOS.find(function(x){ return x.id === id; });
    return p ? cardHTML(p) : '';
  }).join('');

  var st = $('#stories');
  st.innerHTML = CATEGORIAS.map(function(c){
    return '<button class="st" data-cat="'+c.slug+'">'
      + '<div class="ring"><div><img src="data:image/jpeg;base64,'+c.img+'" alt=""></div></div>'
      + '<span>'+esc(c.nome.split(',')[0].split(' E ')[0].trim())+'</span></button>';
  }).join('');

  var sec = $('#secoes'), html = '';
  CATEGORIAS.forEach(function(c, i){
    var itens = PRODUTOS.filter(function(p){ return p.c === c.nome; });
    html += '<section class="catsec" id="cat-'+c.slug+'" data-cat="'+c.slug+'">'
      + '<div class="head"><h2>'+esc(c.nome.charAt(0)+c.nome.slice(1).toLowerCase())+'</h2>'
      + '<span>'+itens.length+' itens</span></div>'
      + '<div class="grid">'+itens.map(cardHTML).join('')+'</div></section>';
    if(i % 3 === 2 && i < CATEGORIAS.length - 1) html += bandaHTML();
  });
  sec.innerHTML = html + bandaHTML();
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
  if(it) it.q += qtd; else carrinho.push({ id:p.id, n:p.n, p:p.p, img:p.img, q:qtd });
  renderCarrinho();
  toast(qtd + (qtd > 1 ? ' unidades adicionadas' : ' unidade adicionada'));
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
function total(){ return carrinho.reduce(function(s,i){ return s + i.p * i.q; }, 0); }

function renderCarrinho(){
  var n = carrinho.reduce(function(s,i){ return s + i.q; }, 0);
  var b = $('#cartCount');
  b.textContent = n; b.classList.toggle('hidden', n === 0);

  var box = $('#ditems');
  if(!carrinho.length){
    box.innerHTML = '<div class="empty">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>'
      + 'Seu orçamento está vazio.<br>Adicione produtos do catálogo.</div>';
  } else {
    box.innerHTML = carrinho.map(function(i){
      return '<div class="ci" data-id="'+i.id+'">'
        + '<img src="data:image/jpeg;base64,'+i.img+'" alt="">'
        + '<div class="d"><h4>'+esc(i.n)+'</h4>'
        + '<div class="r"><div class="q">'
        + '<button data-cact="dec" aria-label="Menos">&minus;</button><span>'+i.q+'</span>'
        + '<button data-cact="inc" aria-label="Mais">+</button></div>'
        + '<b>'+brl(i.p * i.q)+'</b></div>'
        + '<button class="rm" data-cact="rm">remover</button>'
        + '</div></div>';
    }).join('');
  }
  $('#total').textContent = brl(total());

  var wa = $('#waBtn');
  if(!carrinho.length){ wa.setAttribute('disabled',''); wa.href = '#'; }
  else {
    wa.removeAttribute('disabled');
    var linhas = carrinho.map(function(i){
      return '- ' + i.n + ' (cod ' + i.id + ') | ' + i.q + ' un | ' + brl(i.p * i.q);
    });
    var msg = 'Olá! Tenho interesse neste orçamento:\n\n' + linhas.join('\n')
      + '\n\nTotal estimado: ' + brl(total());
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

/* ---------- EVENTOS ---------- */
document.addEventListener('click', function(e){
  var b = e.target.closest('[data-act]');
  if(b){
    var card = b.closest('.card'), qv = card.querySelector('.qv');
    var q = parseInt(qv.textContent, 10) || 1, act = b.dataset.act;
    if(act === 'inc'){ qv.textContent = q + 1; }
    else if(act === 'dec'){ qv.textContent = Math.max(1, q - 1); }
    else if(act === 'add'){
      addItem(card.dataset.id, q);
      qv.textContent = '1';
      b.textContent = 'Adicionado ✓'; b.classList.add('ok');
      setTimeout(function(){ b.textContent = 'Adicionar'; b.classList.remove('ok'); }, 1200);
    }
    return;
  }
  var c = e.target.closest('[data-cact]');
  if(c){
    var it = c.closest('.ci'), id = it.dataset.id;
    var cur = carrinho.find(function(x){ return x.id === id; });
    if(!cur) return;
    if(c.dataset.cact === 'inc') setQtd(id, cur.q + 1);
    else if(c.dataset.cact === 'dec') setQtd(id, cur.q - 1);
    else removeItem(id);
    return;
  }
  var s = e.target.closest('.st');
  if(s){
    var alvo = document.getElementById('cat-' + s.dataset.cat);
    if(alvo){
      $('#q').value = ''; filtrar('');
      var y = alvo.getBoundingClientRect().top + window.pageYOffset - 68;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  }
});
$('#openCart').addEventListener('click', function(){ abrirCarrinho(true); });
$('#closeCart').addEventListener('click', function(){ abrirCarrinho(false); });
$('#ov').addEventListener('click', function(){ abrirCarrinho(false); });
document.addEventListener('keydown', function(e){ if(e.key === 'Escape') abrirCarrinho(false); });

/* ---------- BUSCA ---------- */
function filtrar(termo){
  var t = norm(termo.trim());
  var achou = 0;
  document.querySelectorAll('.catsec').forEach(function(sec){
    var vis = 0;
    sec.querySelectorAll('.card').forEach(function(c){
      var ok = !t || c.dataset.busca.indexOf(t) > -1;
      c.classList.toggle('hidden', !ok);
      if(ok) vis++;
    });
    sec.classList.toggle('hidden', vis === 0);
    achou += vis;
  });
  $('#secDestaques').classList.toggle('hidden', !!t);
  $('#stories').classList.toggle('hidden', !!t);
  document.querySelectorAll('.benband').forEach(function(b){ b.classList.toggle('hidden', !!t); });
  $('#nores').style.display = (t && achou === 0) ? 'block' : 'none';
}
var dt;
$('#q').addEventListener('input', function(e){
  clearTimeout(dt);
  var v = e.target.value;
  dt = setTimeout(function(){ filtrar(v); }, 130);
});

/* ---------- BANNER ---------- */
var bi = 0, nb = 2;
var dots = $('#bdots');
dots.innerHTML = '<i class="on"></i><i></i>';
function goB(i){
  bi = (i + nb) % nb;
  $('#btrack').style.transform = 'translateX(' + (-bi * 100) + '%)';
  dots.querySelectorAll('i').forEach(function(d, k){ d.classList.toggle('on', k === bi); });
}
$('#bnext').addEventListener('click', function(){ goB(bi + 1); reiniciar(); });
$('#bprev').addEventListener('click', function(){ goB(bi - 1); reiniciar(); });
dots.addEventListener('click', function(e){
  var i = [].indexOf.call(dots.children, e.target);
  if(i > -1){ goB(i); reiniciar(); }
});
var auto = setInterval(function(){ goB(bi + 1); }, 5500);
function reiniciar(){ clearInterval(auto); auto = setInterval(function(){ goB(bi + 1); }, 5500); }

/* ---------- SETAS DO CARROSSEL ---------- */
$('#cnext').addEventListener('click', function(){
  var c = $('#caro'); c.scrollBy({ left: c.clientWidth * 0.8, behavior: 'smooth' });
});
$('#cprev').addEventListener('click', function(){
  var c = $('#caro'); c.scrollBy({ left: -c.clientWidth * 0.8, behavior: 'smooth' });
});

montar();
renderCarrinho();
})();
</script>
</body>
</html>
"""


def main():
    produtos, categorias = carregar_produtos()
    print(f"[HTML] {len(produtos)} produtos, {len(categorias)} categorias")
    html = montar_html(produtos, categorias)
    OUT.write_text(html, encoding="utf-8")
    mb = OUT.stat().st_size / 1024 / 1024
    print(f"[HTML] Gerado {OUT} ({mb:.2f} MB)")


if __name__ == "__main__":
    main()
