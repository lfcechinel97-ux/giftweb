#!/usr/bin/env python3
"""Checagem independente da contração do TOYO (não usa o Clipper).

  python scripts/carteladtf/validar_contracao.py original_textil.pdf contraido.pdf 0.15 [dpi] [janela_mm]

janela_mm (opcional) = "x,y,l,a" em mm a partir do canto superior esquerdo da
folha: mede só essa região (para logos grandes em dpi alto).

Os dois PDFs devem ser cartelas de 1 logo com os mesmos parâmetros (um em
DTF Têxtil, outro em DTF UV contraído). A logo original é rasterizada pelo
poppler (pdftoppm, sem antialias); os polígonos do TOYO são lidos do PDF
e posicionados com a matriz da página. Confere:
 (a) TOYO 100% dentro da logo original;
 (b) os vértices do contorno do TOYO ficam a ~d mm da borda da original (±0,02 mm;
     só as cúspides, onde uma parte fina sumiu, ficam mais longe).
"""
import re, subprocess, sys, tempfile, os
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import distance_transform_edt
from pypdf import PdfReader

orig, contr, d = sys.argv[1], sys.argv[2], float(sys.argv[3])
dpi = int(sys.argv[4]) if len(sys.argv) > 4 else 2400
jan = [float(v) for v in sys.argv[5].split(',')] if len(sys.argv) > 5 else None
Image.MAX_IMAGE_PIXELS = None
TOL = 0.02
mm_px = 25.4 / dpi

r = PdfReader(contr); pg = r.pages[0]
H = float(pg.mediabox.height)
xo = pg['/Resources']['/XObject']
toyo = [xo[k].get_object() for k in xo if k.startswith('/FmT')][0]
data = toyo.get_data().decode('latin1')
assert '/GSop gs' in data and '/CSspot cs 1 scn' in data
assert not re.search(r'\b(k|K|rg|RG|g|G|sc|SC)\b', data), 'TOYO usa cor que não é o spot'
sep = toyo['/Resources']['/ColorSpace']['/CSspot']
gs = toyo['/Resources']['/ExtGState']['/GSop']
assert sep[0] == '/Separation' and bool(gs['/op']) and bool(gs['/OP']) and gs['/OPM'] == 1
m = [float(v) for v in toyo['/Matrix']]
cont = pg.get_contents().get_data().decode('latin1')
cm = re.search(r'q\s+([-\d. ]+)\s+cm\s+/FmT', cont).group(1).split()
s, tx, ty = float(cm[0]), float(cm[4]), float(cm[5])

polys = []
for bloco in re.findall(r'([-\d. ]+ m\n(?:[-\d. ]+ l\n)+)h', data):
    pts = [tuple(map(float, l.split()[:2])) for l in bloco.strip().split('\n')]
    polys.append([((x + m[4]) * s + tx, (y + m[5]) * s + ty) for x, y in pts])  # pt na página
print(f'TOYO: {len(polys)} polígonos, {sum(map(len, polys))} vértices; spot {sep[1]} op/OP true OPM 1')

with tempfile.TemporaryDirectory() as tmp:
    base = os.path.join(tmp, 'o')
    corte = []
    ox = oy = 0
    if jan:
        ox, oy = round(jan[0] / 25.4 * dpi), round(jan[1] / 25.4 * dpi)
        corte = ['-x', str(ox), '-y', str(oy), '-W', str(round(jan[2] / 25.4 * dpi)), '-H', str(round(jan[3] / 25.4 * dpi))]
    subprocess.run(['pdftoppm', '-r', str(dpi), '-gray', '-aa', 'no', '-aaVector', 'no', *corte, '-singlefile', '-png', orig, base], check=True)
    img = np.array(Image.open(base + '.png').convert('L'))
logo = img < 250                     # pixel pintado da original (qualquer cor)
h, w = logo.shape
toPx = lambda x, y: (x * dpi / 72 - ox, (H - y) * dpi / 72 - oy)

# (a) rasteriza o TOYO (par-ímpar, como o f*) e confere que está dentro da original
mask = np.zeros((h, w), bool)
for p in polys:
    im = Image.new('1', (w, h), 0)
    ImageDraw.Draw(im).polygon([toPx(*q) for q in p], fill=1)
    mask ^= np.array(im)
fora = mask & ~logo
# 1 px de folga por arredondamento do raster
fora_real = fora & (distance_transform_edt(~logo) > 1.5)
if jan:  # polígono cortado pela janela: ignora a moldura
    fora_real[:3, :] = fora_real[-3:, :] = False; fora_real[:, :3] = fora_real[:, -3:] = False
print(f'(a) pixels do TOYO fora da original: {int(fora_real.sum())} (de {int(mask.sum())})')

# (b) distância de cada vértice do TOYO até a borda da original
# EDT discreto mede do centro do pixel ao centro do pixel de fundo: a borda
# real fica meio pixel antes
edt = (distance_transform_edt(logo) - 0.5) * mm_px
dist = []
for p in polys:
    for x, y in p:
        px, py = toPx(x, y)
        i, j = int(round(py)), int(round(px))
        if 3 <= i < h - 3 and 3 <= j < w - 3:
            dist.append(edt[i, j])
dist = np.array(dist)
dentro = np.abs(dist - d) <= TOL
print(f'(b) distância vértice->borda (mm): min {dist.min():.4f}  mediana {np.median(dist):.4f}  max {dist.max():.4f}  '
      f'(pixel = {mm_px:.4f} mm); {100 * dentro.mean():.1f}% dos vértices em {d} ± {TOL} mm')
# vértices acima de d+tol: cúspides onde duas frentes do offset se encontram
# (ex.: onde uma peça fina sumiu); por definição ficam a mais de d da borda
print(f'    cúspides (> d + tol): {int((dist > d + TOL).sum())}; abaixo de d - tol: {int((dist < d - TOL).sum())}')
ok_a = fora_real.sum() == 0
ok_b = abs(np.median(dist) - d) <= TOL and dist.min() >= d - TOL and dentro.mean() >= 0.95
print('RESULTADO:', 'OK' if ok_a and ok_b else 'FALHOU')
sys.exit(0 if ok_a and ok_b else 1)
