#!/usr/bin/env python3
"""Compara folha e posições (matriz final de cada logo) entre dois PDFs de cartela.
  python scripts/carteladtf/comparar_posicoes.py referencia.pdf web.pdf
Para cada Do da página, calcula onde cai o canto (left,bottom) do MediaBox da
logo: assim compara a referência (cm com x - x0*s) com o pdf-lib (cm + /Matrix)."""
import re, sys
from pypdf import PdfReader

NUM = r'[-+]?(?:\d+\.?\d*|\.\d+)'


def mul(a, b):
    return [a[0]*b[0]+a[1]*b[2], a[0]*b[1]+a[1]*b[3], a[2]*b[0]+a[3]*b[2], a[2]*b[1]+a[3]*b[3],
            a[4]*b[0]+a[5]*b[2]+b[4], a[4]*b[1]+a[5]*b[3]+b[5]]


def logos(path):
    r = PdfReader(path); p = r.pages[0]
    xo = p['/Resources']['/XObject']
    data = p.get_contents().get_data().decode('latin1')
    ctm = [1, 0, 0, 1, 0, 0]; st = []; out = []
    for tok in re.finditer(rf'((?:{NUM}\s+){{6}})cm|\bq\b|\bQ\b|(/\S+)\s+Do', data):
        t = tok.group(0)
        if t == 'q': st.append(ctm)
        elif t == 'Q': ctm = st.pop()
        elif t.endswith('cm'): ctm = mul([float(v) for v in tok.group(1).split()], ctm)
        else:
            f = xo[tok.group(2)].get_object()
            m = [float(v) for v in f.get('/Matrix', [1, 0, 0, 1, 0, 0])]
            bb = [float(v) for v in f['/BBox']]
            full = mul(m, ctm)
            x = full[0]*bb[0] + full[2]*bb[1] + full[4]; y = full[1]*bb[0] + full[3]*bb[1] + full[5]
            out.append((tok.group(2), round(x, 3), round(y, 3), round(full[0], 6), round(full[3], 6), tuple(round(v, 3) for v in bb)))
    return [float(v) for v in p.mediabox], out


a, la = logos(sys.argv[1]); b, lb = logos(sys.argv[2])
print('folha ref', [round(v, 3) for v in a], 'web', [round(v, 3) for v in b])
assert all(abs(x - y) < 1e-3 for x, y in zip(a, b)), 'folha diferente'
assert len(la) == len(lb), f'qtd de desenhos diferente {len(la)} x {len(lb)}'
for (na, *ra), (nb, *rb) in zip(la, lb):
    assert all(abs(x - y) < 1e-3 for x, y in zip(ra[:4], rb[:4])), (ra, rb)
    assert ra[4] == rb[4], ('BBox', ra[4], rb[4])
print(f'OK: {len(la)} desenhos (base+toyo) nas mesmas posições/escala/BBox; ex.: {la[0]}')
