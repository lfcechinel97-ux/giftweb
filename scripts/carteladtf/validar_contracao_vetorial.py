#!/usr/bin/env python3
"""Checagem vetorial exata (shapely) da contração, para a logo de teste
logo_corel.pdf de gerar_logos_teste.py (geometria reconstruída aqui, de
forma independente do interpretador e do Clipper da ferramenta).

  python scripts/carteladtf/validar_contracao_vetorial.py contraido.pdf largura_cm 0.15
"""
import sys, numpy as np
from shapely.geometry import Polygon, LineString, box, Point
from shapely.ops import unary_union
from shapely import affinity
from pypdf import PdfReader

CM = 72 / 2.54
K = 0.5523
pdf, larg, d = sys.argv[1], float(sys.argv[2]), float(sys.argv[3])
s = larg * CM / 381.67
mm = lambda v: v * s / CM * 10


def bez(p0, p1, p2, p3, n=200):
    t = np.linspace(0, 1, n)[:, None]
    return ((1-t)**3*p0 + 3*(1-t)**2*t*p1 + 3*(1-t)*t**2*p2 + t**3*p3)


def circle(cx, cy, r):
    k = K * r; c = np.array([cx, cy])
    P = [(r, 0), (r, k), (k, r), (0, r), (-k, r), (-r, k), (-r, 0), (-r, -k), (-k, -r), (0, -r), (k, -r), (r, -k), (r, 0)]
    P = [c + np.array(p) for p in P]
    pts = np.vstack([bez(P[i], P[i+1], P[i+2], P[i+3]) for i in range(0, 12, 3)])
    return Polygon(pts)


def stroke(coords, w, cap, join):
    return LineString(coords).buffer(w / 2, cap_style=cap, join_style=join, quad_segs=256, mitre_limit=10)


ring = circle(120, 250, 100).difference(circle(120, 250, 50))
tri = Polygon([(230, 150), (370, 150), (300, 360)]).intersection(box(220, 140, 370, 370))
L = stroke([(20, 40), (200, 40), (200, 120)], 8, 'round', 'round')
small = affinity.affine_transform(circle(100, 100, 80), [0.5, 0, 0, 0.5, 250, 10])
bar = box(20, 345, 200, 346)
roof = stroke([(230, 60), (300, 120), (360, 60)], 4, 'flat', 'mitre')
U = unary_union([ring, tri, L, small, bar, roof])
B = U.boundary

r = PdfReader(pdf); xo = r.pages[0]['/Resources']['/XObject']
t = [xo[k].get_object() for k in xo if k.startswith('/FmT')][0].get_data().decode('latin1')
pts = [tuple(map(float, l.split()[:2])) for l in t.splitlines() if l.endswith((' l', ' m'))]
dist = np.array([mm(B.distance(Point(p))) for p in pts])
inside = np.array([U.contains(Point(p)) for p in pts])
ok = np.abs(dist - d) <= 0.02
print(f'{larg} cm: {len(pts)} vértices; todos dentro da original: {inside.all()}; '
      f'dist mm min {dist.min():.4f} mediana {np.median(dist):.4f} max {dist.max():.4f}; '
      f'{100*ok.mean():.1f}% em {d}±0,02')
bad = [(p, round(v, 4)) for p, v in zip(pts, dist) if abs(v - d) > 0.02]
if bad: print('  fora da tolerância:', bad[:10])
sys.exit(0 if inside.all() and ok.all() else 1)
