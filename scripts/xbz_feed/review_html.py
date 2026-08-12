"""Fase 2.5 — gera output/revisao_imagens.html: grade com a foto principal e os
candidatos a foto secundária de cada produto, para aprovação manual do usuário
(decisão tomada: não existe 'foto coletiva com todas as cores' em nenhuma fonte,
então o additional_image_link só é preenchido depois dessa revisão)."""
from __future__ import annotations

import html

from . import config
from .images import ImagemProcessada
from .resolve import ProdutoResolvido

MAX_CANDIDATOS_EXIBIDOS = 8


def _img_tag(url: str, borda_vermelha: bool = False, largura: int = 180) -> str:
    borda = "border:4px solid #e11d48;" if borda_vermelha else "border:1px solid #ddd;"
    return (
        f'<img src="{html.escape(url)}" loading="lazy" '
        f'style="width:{largura}px;height:{largura}px;object-fit:contain;background:#fff;{borda}border-radius:6px;">'
    )


def gerar_html(
    resolvidos: list[ProdutoResolvido],
    imagens_principais_processadas: dict[str, ImagemProcessada],
    urls_capa_final: dict[str, str],
) -> str:
    cards = []
    for p in resolvidos:
        if not p.imagem_principal:
            cards.append(
                f'<div class="card erro"><h3>{html.escape(p.codigo_entrada)}</h3>'
                f'<p class="aviso">Sem nenhuma imagem disponível (nem curada, nem API).</p></div>'
            )
            continue

        capa_url = urls_capa_final.get(p.codigo_entrada, p.imagem_principal.url)
        proc = imagens_principais_processadas.get(p.codigo_entrada)
        watermark = bool(proc and proc.watermark_suspeito)

        candidatos_html = []
        for i, c in enumerate(p.candidatos_secundarios[:MAX_CANDIDATOS_EXIBIDOS], start=1):
            candidatos_html.append(
                f'<div class="candidato">'
                f'{_img_tag(c.url, largura=110)}'
                f'<div class="label">#{i} &middot; {html.escape(c.label)}</div>'
                f'</div>'
            )
        restantes = len(p.candidatos_secundarios) - MAX_CANDIDATOS_EXIBIDOS
        extra_note = f'<p class="muted">+{restantes} candidato(s) não exibido(s)</p>' if restantes > 0 else ""

        cores_txt = ", ".join(p.cores_disponiveis) if p.cores_disponiveis else "—"
        avisos_html = "".join(f'<li>{html.escape(a)}</li>' for a in p.avisos)

        cards.append(f"""
        <div class="card {'watermark' if watermark else ''}">
          <h3>{html.escape(p.codigo_entrada)} <span class="fonte">({p.fonte_textos or 'não encontrado'})</span></h3>
          <p class="nome">{html.escape(p.nome or '—')}</p>
          <div class="linha">
            <div class="capa">
              <div class="rotulo">CAPA (image_link)</div>
              {_img_tag(capa_url, borda_vermelha=watermark, largura=200)}
              {'<div class="tag-watermark">⚠ possível marca d’água</div>' if watermark else ''}
            </div>
            <div class="candidatos">
              <div class="rotulo">CANDIDATOS a additional_image_link ({len(p.candidatos_secundarios)})</div>
              <div class="grade-candidatos">{''.join(candidatos_html) or '<p class="muted">nenhum candidato encontrado</p>'}</div>
              {extra_note}
            </div>
          </div>
          <p class="cores"><b>Cores:</b> {html.escape(cores_txt)}</p>
          {f'<ul class="avisos">{avisos_html}</ul>' if avisos_html else ''}
        </div>
        """)

    total = len(resolvidos)
    watermark_count = sum(1 for c in imagens_principais_processadas.values() if c.watermark_suspeito)

    return f"""<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Revisão de imagens — catálogo Meta</title>
<style>
  body {{ font-family: -apple-system, Segoe UI, Arial, sans-serif; background:#f5f5f5; color:#222; margin:0; padding:24px; }}
  h1 {{ font-size:20px; }}
  .resumo {{ margin-bottom:20px; color:#555; }}
  .grid {{ display:grid; grid-template-columns:repeat(auto-fill, minmax(560px,1fr)); gap:16px; }}
  .card {{ background:#fff; border-radius:10px; padding:14px 16px; box-shadow:0 1px 3px rgba(0,0,0,.1); }}
  .card.erro {{ border:2px solid #e11d48; }}
  .card h3 {{ margin:0 0 4px; font-size:16px; }}
  .card .fonte {{ font-weight:normal; color:#888; font-size:12px; }}
  .card .nome {{ margin:0 0 10px; color:#444; font-size:13px; }}
  .linha {{ display:flex; gap:16px; }}
  .rotulo {{ font-size:10px; letter-spacing:.05em; text-transform:uppercase; color:#888; margin-bottom:6px; }}
  .grade-candidatos {{ display:flex; flex-wrap:wrap; gap:8px; }}
  .candidato {{ text-align:center; }}
  .candidato .label {{ font-size:10px; color:#666; max-width:110px; margin-top:2px; }}
  .tag-watermark {{ color:#e11d48; font-size:11px; font-weight:bold; margin-top:4px; }}
  .cores {{ font-size:12px; color:#555; margin:10px 0 0; }}
  .avisos {{ font-size:11px; color:#b45309; margin:8px 0 0; padding-left:16px; }}
  .muted {{ color:#999; font-size:11px; }}
</style>
</head>
<body>
<h1>Revisão de imagens — catálogo Meta (WhatsApp)</h1>
<p class="resumo">
  {total} produtos · {watermark_count} com suspeita de marca d'água (borda vermelha) ·
  <b>additional_image_link não será preenchido até você indicar qual candidato usar por produto.</b>
  Responda no chat referenciando "código #número", ex: "02596 #2".
</p>
<div class="grid">
{''.join(cards)}
</div>
</body>
</html>
"""


def gerar_e_salvar(
    resolvidos: list[ProdutoResolvido],
    imagens_principais_processadas: dict[str, ImagemProcessada],
    urls_capa_final: dict[str, str],
) -> None:
    conteudo = gerar_html(resolvidos, imagens_principais_processadas, urls_capa_final)
    out = config.OUTPUT_DIR / "revisao_imagens.html"
    out.write_text(conteudo, encoding="utf-8")
    print(f"[REVIEW] Gerado {out}")
