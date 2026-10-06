#!/usr/bin/env python3
"""
Gerador de cartela DTF (vetorial) com camada spot TOYO por cima.

Uso:
  pip install pypdf
  python gerar_cartela_dtf.py logo.pdf --largura 7 --qtd 30 --espaco 1 --folha-max 57

Opções úteis:
  --sem-toyo          gera só a logo original (DTF têxtil)
  --cheio             enche a linha ao máximo (padrão = distribui igualmente nas linhas)
  --margem 0.5        margem da borda em cm
  --spot "TOYO 0001pc" --cmyk 33 90 3 0   nome e cor de visualização do spot
  -o saida.pdf

A logo precisa ser PDF VETORIAL (exporte do Corel/Illustrator). Página 1 é usada.
Camada TOYO: cópia da logo com TODAS as cores trocadas pelo spot a 100%,
com impressão sobreposta (overprint) do preenchimento ativada.
"""
import argparse, math, re, sys
from pypdf import PdfReader, PdfWriter
from pypdf.generic import (NameObject, ArrayObject, FloatObject, NumberObject, DictionaryObject,
                           DecodedStreamObject, BooleanObject)

CM = 72 / 2.54
NUM = r'[-+]?(?:\d+\.?\d*|\.\d+)'


def spot_layer(content: str):
    """Troca todas as cores do content stream pelo spot e liga overprint."""
    warns = []
    if re.search(r'\bBI\b', content): warns.append('imagem embutida (inline) não é recolorida')
    if re.search(r'/\S+\s+sh\b', content): warns.append('gradiente (shading) não é recolorido')
    if re.search(r'/\S+\s+Do\b', content): warns.append('objeto externo (imagem/grupo) não é recolorido')
    c = content
    # cores diretas -> spot (fill minúsculo, stroke maiúsculo)
    c = re.sub(rf'(?:{NUM}\s+){{4}}k\b', '/CSspot cs 1 scn', c)
    c = re.sub(rf'(?:{NUM}\s+){{4}}K\b', '/CSspot CS 1 SCN', c)
    c = re.sub(rf'(?:{NUM}\s+){{3}}rg\b', '/CSspot cs 1 scn', c)
    c = re.sub(rf'(?:{NUM}\s+){{3}}RG\b', '/CSspot CS 1 SCN', c)
    c = re.sub(rf'(?<![\w/.]){NUM}\s+g\b', '/CSspot cs 1 scn', c)
    c = re.sub(rf'(?<![\w/.]){NUM}\s+G\b', '/CSspot CS 1 SCN', c)
    # espaço de cor nomeado + valores
    c = re.sub(rf'/[^\s/\[\]<>()]+\s+cs\s+(?:{NUM}\s+)+scn?\b', '/CSspot cs 1 scn', c)
    c = re.sub(rf'/[^\s/\[\]<>()]+\s+CS\s+(?:{NUM}\s+)+SCN?\b', '/CSspot CS 1 SCN', c)
    # overprint: no início e depois de cada gs (que poderia desligar)
    c = re.sub(r'(/\S+\s+gs\b)', r'\1 /GSop gs', c)
    c = '/GSop gs\n/CSspot cs 1 scn\n/CSspot CS 1 SCN\n' + c
    return c, warns


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('logo')
    ap.add_argument('--largura', type=float, required=True, help='largura da logo (cm)')
    ap.add_argument('--qtd', type=int, required=True)
    ap.add_argument('--espaco', type=float, default=1.0, help='espaçamento (cm)')
    ap.add_argument('--folha-max', type=float, default=57.0, help='largura máxima da folha (cm)')
    ap.add_argument('--margem', type=float, default=0.5)
    ap.add_argument('--sem-toyo', action='store_true')
    ap.add_argument('--cheio', action='store_true')
    ap.add_argument('--spot', default='TOYO 0001pc')
    ap.add_argument('--cmyk', type=float, nargs=4, default=[33, 90, 3, 0])
    ap.add_argument('-o', '--saida')
    a = ap.parse_args()

    src = PdfReader(a.logo).pages[0]
    b = src.mediabox
    x0, y0, w, h = float(b.left), float(b.bottom), float(b.width), float(b.height)

    W = a.largura * CM; s = W / w; H = h * s
    G = a.espaco * CM; M = a.margem * CM
    max_cols = int((a.folha_max * CM - 2 * M + G + 1e-6) // (W + G))
    if max_cols < 1:
        sys.exit('A logo não cabe na largura máxima da folha.')
    if a.cheio:
        cols = min(max_cols, a.qtd)
    else:
        rows_ = math.ceil(a.qtd / max_cols)
        cols = math.ceil(a.qtd / rows_)
    rows = math.ceil(a.qtd / cols)
    pw = 2 * M + cols * W + (cols - 1) * G
    ph = 2 * M + rows * H + (rows - 1) * G

    out = PdfWriter()
    page = out.add_blank_page(width=pw, height=ph)
    bbox = ArrayObject([FloatObject(v) for v in (x0, y0, x0 + w, y0 + h)])
    data = src.get_contents().get_data().decode('latin1')

    def form(content, res):
        f = DecodedStreamObject(); f.set_data(content.encode('latin1'))
        f.update({NameObject('/Type'): NameObject('/XObject'), NameObject('/Subtype'): NameObject('/Form'),
                  NameObject('/BBox'): bbox, NameObject('/Resources'): res})
        return out._add_object(f)

    xobjs = {NameObject('/FmB'): form(data, src['/Resources'].clone(out))}

    if not a.sem_toyo:
        top, warns = spot_layer(data)
        for wmsg in warns: print('AVISO:', wmsg)
        res = src['/Resources'].clone(out)
        tint = DictionaryObject({
            NameObject('/FunctionType'): NumberObject(2),
            NameObject('/Domain'): ArrayObject([NumberObject(0), NumberObject(1)]),
            NameObject('/C0'): ArrayObject([FloatObject(0)] * 4),
            NameObject('/C1'): ArrayObject([FloatObject(v / 100) for v in a.cmyk]),
            NameObject('/N'): NumberObject(1)})
        sep = ArrayObject([NameObject('/Separation'), NameObject('/' + a.spot),
                           NameObject('/DeviceCMYK'), tint])
        cs = DictionaryObject(dict(res['/ColorSpace'].get_object())) if '/ColorSpace' in res else DictionaryObject()
        cs[NameObject('/CSspot')] = sep; res[NameObject('/ColorSpace')] = cs
        gs = DictionaryObject(dict(res['/ExtGState'].get_object())) if '/ExtGState' in res else DictionaryObject()
        gs[NameObject('/GSop')] = DictionaryObject({
            NameObject('/Type'): NameObject('/ExtGState'),
            NameObject('/op'): BooleanObject(True), NameObject('/OP'): BooleanObject(True),
            NameObject('/OPM'): NumberObject(1)})
        res[NameObject('/ExtGState')] = gs
        xobjs[NameObject('/FmT')] = form(top, res)

    ops = []
    for i in range(a.qtd):
        r, c = divmod(i, cols)
        x = M + c * (W + G); y = ph - M - H - r * (H + G)
        m = f'{s:.6f} 0 0 {s:.6f} {x - x0 * s:.4f} {y - y0 * s:.4f} cm'
        ops.append(f'q {m} /FmB Do Q')
        if '/FmT' in xobjs: ops.append(f'q {m} /FmT Do Q')   # TOYO sempre por cima
    cont = DecodedStreamObject(); cont.set_data('\n'.join(ops).encode())
    page[NameObject('/Contents')] = out._add_object(cont)
    page[NameObject('/Resources')] = DictionaryObject({NameObject('/XObject'): DictionaryObject(xobjs)})

    saida = a.saida or f"cartela_{a.qtd}x_{a.largura:g}cm{'' if a.sem_toyo else '_toyo'}.pdf"
    out.write(saida)
    print(f'{saida}: {a.qtd} logos, {cols} col x {rows} lin, folha {pw/CM:.2f} x {ph/CM:.2f} cm '
          f'(logo {a.largura:g} x {H/CM:.2f} cm)')


if __name__ == '__main__':
    main()
