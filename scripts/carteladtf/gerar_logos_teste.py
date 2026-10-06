#!/usr/bin/env python3
"""Gera PDFs de logo para testar a ferramenta /carteladtf.

  python scripts/carteladtf/gerar_logos_teste.py <pasta_saida>

logo_corel.pdf   MediaBox [-1 -1 380.67 368.15] (381.67 x 369.15 pt, origem negativa
                 como o Corel exporta), /GS0 gs com op false, cores CMYK, RGB, cinza e
                 Separation, curvas, furo (f*), clip, traço com pontas/juntas redondas,
                 cm aninhado e uma peça fina (some no TOYO contraído).
logo_texto.pdf   logo com texto não convertido em curvas (deve avisar).
logo_imagem.pdf  só imagem, sem vetor (deve dar erro).
logo_vazia.pdf   PDF sem página.
"""
import sys, zlib, os

K = 0.5523  # constante de círculo por Bézier


def circle(cx, cy, r, ccw=True):
    k = K * r
    if ccw:
        pts = [(cx + r, cy), (cx + r, cy + k, cx + k, cy + r, cx, cy + r),
               (cx - k, cy + r, cx - r, cy + k, cx - r, cy),
               (cx - r, cy - k, cx - k, cy - r, cx, cy - r),
               (cx + k, cy - r, cx + r, cy - k, cx + r, cy)]
    else:
        pts = [(cx + r, cy), (cx + r, cy - k, cx + k, cy - r, cx, cy - r),
               (cx - k, cy - r, cx - r, cy - k, cx - r, cy),
               (cx - r, cy + k, cx - k, cy + r, cx, cy + r),
               (cx + k, cy + r, cx + r, cy + k, cx + r, cy)]
    s = f'{pts[0][0]:.3f} {pts[0][1]:.3f} m\n'
    for p in pts[1:]:
        s += ' '.join(f'{v:.3f}' for v in p) + ' c\n'
    return s + 'h\n'


def write_pdf(path, objs):
    """objs: lista de bytes (objeto i+1). Objeto 1 = Catalog."""
    out = bytearray(b'%PDF-1.5\n%\xe2\xe3\xcf\xd3\n')
    offs = []
    for i, o in enumerate(objs):
        offs.append(len(out))
        out += f'{i + 1} 0 obj\n'.encode() + o + b'\nendobj\n'
    xref = len(out)
    out += f'xref\n0 {len(objs) + 1}\n0000000000 65535 f \n'.encode()
    for o in offs:
        out += f'{o:010d} 00000 n \n'.encode()
    out += f'trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n'.encode()
    open(path, 'wb').write(out)


def stream(content: bytes, extra=b'', compress=True):
    data = zlib.compress(content) if compress else content
    filt = b'/Filter /FlateDecode ' if compress else b''
    return b'<< ' + filt + extra + f'/Length {len(data)} >>\nstream\n'.encode() + data + b'\nendstream'


def corel():
    c = '/GS0 gs\n'
    # 1. anel (círculo com furo, even-odd) em CMYK
    c += '0 0.8 1 0 k\n' + circle(120, 250, 100) + circle(120, 250, 50) + 'f*\n'
    # 2. retângulo RGB recortado por um triângulo (clip)
    c += 'q\n230 150 m 370 150 l 300 360 l h W n\n0.1 0.2 0.8 rg\n220 140 150 230 re f\nQ\n'
    # 3. traço em cinza, pontas e juntas redondas
    c += '0.3 G 8 w 1 J 1 j\n20 40 m 200 40 l 200 120 l S\n'
    # 4. espaço de cor nomeado (Separation)
    c += '/CS0 cs 1 scn\n' + 'q 0.5 0 0 0.5 250 10 cm\n' + circle(100, 100, 80) + 'f\nQ\n'
    # 5. peça fina: 1 pt na fonte (~0,18 mm com a logo a 7 cm) -> some no TOYO contraído
    c += '0 0 0 1 k\n20 345 180 1 re f\n'
    # 6. traço CMYK em maiúsculo, juntas em quina
    c += '0 0 0 1 K 4 w 0 J 0 j\n230 60 m 300 120 l 360 60 l S\n'
    return c.encode('latin1')


def main(outdir):
    os.makedirs(outdir, exist_ok=True)
    tint = b'<< /FunctionType 2 /Domain [0 1] /C0 [0 0 0 0] /C1 [0.6 0 1 0] /N 1 >>'
    res = (b'<< /ExtGState << /GS0 << /Type /ExtGState /op false /OP false /OPM 0 /SA false >> >> '
           b'/ColorSpace << /CS0 [/Separation /PANTONE#20368#20C /DeviceCMYK ' + tint + b'] >> >>')
    write_pdf(os.path.join(outdir, 'logo_corel.pdf'), [
        b'<< /Type /Catalog /Pages 2 0 R >>',
        b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        b'<< /Type /Page /Parent 2 0 R /MediaBox [-1 -1 380.67 368.15] /Contents 4 0 R /Resources ' + res + b' >>',
        stream(corel()),
    ])
    # texto não convertido em curvas
    txt = b'/GS0 gs 0 0 0 1 k 10 10 180 80 re f BT /F1 48 Tf 0 0 1 rg 20 100 Td (GIFT) Tj ET'
    write_pdf(os.path.join(outdir, 'logo_texto.pdf'), [
        b'<< /Type /Catalog /Pages 2 0 R >>',
        b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 160] /Contents 4 0 R /Resources '
        b'<< /ExtGState << /GS0 << /op false >> >> /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> >>',
        stream(txt),
    ])
    # só imagem
    px = bytes([255, 0, 0] * 4)
    write_pdf(os.path.join(outdir, 'logo_imagem.pdf'), [
        b'<< /Type /Catalog /Pages 2 0 R >>',
        b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 100 100] /Contents 4 0 R /Resources << /XObject << /Im0 5 0 R >> >> >>',
        stream(b'q 100 0 0 100 0 0 cm /Im0 Do Q'),
        stream(px, b'/Type /XObject /Subtype /Image /Width 2 /Height 2 /ColorSpace /DeviceRGB /BitsPerComponent 8 ', compress=False),
    ])
    write_pdf(os.path.join(outdir, 'logo_vazia.pdf'), [
        b'<< /Type /Catalog /Pages 2 0 R >>',
        b'<< /Type /Pages /Kids [] /Count 0 >>',
    ])
    print('ok', outdir)


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '.')
