"""Gera output/relatorio.md com o resumo da execução."""
from __future__ import annotations

from datetime import datetime, timezone

from . import config


def gerar_relatorio(
    total_processado: int,
    total_no_csv: int,
    avisos_por_codigo: dict[str, list[str]],
    excluidos: list[dict],
    observacoes_gerais: list[str],
) -> None:
    linhas = [
        "# Relatório — Feed Meta (catálogo WhatsApp) — XBZ Brindes",
        "",
        f"Gerado em {datetime.now(timezone.utc).isoformat()}",
        "",
        "## Resumo",
        "",
        f"- Total de códigos processados: {total_processado}",
        f"- Total de linhas no CSV final: {total_no_csv}",
        f"- Total de códigos excluídos: {len(excluidos)}",
        "",
    ]

    if observacoes_gerais:
        linhas += ["## Observações gerais", ""]
        linhas += [f"- {o}" for o in observacoes_gerais]
        linhas.append("")

    if excluidos:
        linhas += ["## Códigos excluídos do CSV", "", "| Código | Motivo |", "|---|---|"]
        for e in excluidos:
            for motivo in e["motivos"]:
                linhas.append(f"| {e['codigo']} | {motivo} |")
        linhas.append("")

    codigos_com_aviso = {c: avs for c, avs in avisos_por_codigo.items() if c not in {e["codigo"] for e in excluidos}}
    if codigos_com_aviso:
        linhas += ["## Avisos (produto incluído no CSV, mas com ressalva)", "", "| Código | Aviso |", "|---|---|"]
        for codigo, avs in codigos_com_aviso.items():
            for aviso in avs:
                linhas.append(f"| {codigo} | {aviso} |")
        linhas.append("")

    out_path = config.OUTPUT_DIR / "relatorio.md"
    out_path.write_text("\n".join(linhas), encoding="utf-8")
    print(f"[REPORT] Gerado {out_path}")
