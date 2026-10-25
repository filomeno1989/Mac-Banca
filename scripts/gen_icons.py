#!/usr/bin/env python3
"""Gera os ícones PWA do Sistema de Gestão de Banca.
Desenho: fundo em gradiente esmeralda, toldo de banca (listras) e letra B branca."""
import os
from PIL import Image, ImageDraw, ImageFont

OUT = '/home/z/my-project/public'
os.makedirs(os.path.join(OUT, 'icons'), exist_ok=True)

EM1 = (16, 185, 129)    # emerald-500 (topo)
EM2 = (5, 150, 105)     # emerald-600 (base)
EM_DARK = (6, 95, 70)   # emerald-800 (listras)
WHITE = (255, 255, 255)

FONT_BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'


def gradient(size, top, bottom):
    w, h = size
    img = Image.new('RGB', size, top)
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(1, h - 1)
        c = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
        d.line([(0, y), (w, y)], fill=c)
    return img


def draw_content(img, box, canopy_top_ratio, letter_ratio=0.40):
    """Desenha o toldo (listras com bainha redonda) e a letra B, dentro da box."""
    d = ImageDraw.Draw(img)
    x0, y0, x1, y1 = box
    bw = x1 - x0
    # Toldo
    n = 8
    sw = bw / n
    top = y0 + canopy_top_ratio * bw
    hgt = 0.15 * bw
    for i in range(n):
        c = WHITE if i % 2 == 0 else EM_DARK
        sx0 = x0 + i * sw
        d.rectangle([sx0, top, sx0 + sw, top + hgt], fill=c)
        d.pieslice([sx0, top + hgt - sw, sx0 + sw, top + hgt], 0, 180, fill=c)
    # Letra B
    font = ImageFont.truetype(FONT_BOLD, int(bw * letter_ratio))
    bb = d.textbbox((0, 0), 'B', font=font)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    cx = x0 + bw / 2 - tw / 2 - bb[0]
    cy = y0 + bw * 0.62 - th / 2 - bb[1]
    d.text((cx, cy), 'B', font=font, fill=WHITE)
    return img


def make_icon(size, rounded, padded):
    """rounded: cantos arredondados (PNG transparente); padded: conteúdo no centro (maskable)."""
    bg = gradient((size, size), EM1, EM2).convert('RGBA')
    if padded:
        pad = int(size * 0.16)
        box = (pad, pad, size - pad, size - pad)
        draw_content(bg, box, canopy_top_ratio=0.10)
        return bg  # maskable: full-bleed, sem transparência
    box = (0, 0, size, size)
    draw_content(bg, box, canopy_top_ratio=0.26 if rounded else 0.18)
    if rounded:
        r = int(size * 0.20)
        mask = Image.new('L', (size, size), 0)
        ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=255)
        out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        out.paste(bg, (0, 0), mask)
        return out
    return bg  # apple-touch-icon: full-bleed RGB-like (sem transparência nos cantos)


# Ícones PWA (com cantos arredondados)
make_icon(512, rounded=True, padded=False).save(os.path.join(OUT, 'icons', 'icon-512.png'))
make_icon(192, rounded=True, padded=False).save(os.path.join(OUT, 'icons', 'icon-192.png'))

# Maskable (full-bleed, conteúdo centrado)
make_icon(512, rounded=False, padded=True).save(os.path.join(OUT, 'icons', 'maskable-512.png'))

# Apple touch icon 180 (full-bleed, iOS aplica o próprio canto)
make_icon(180, rounded=False, padded=False).save(os.path.join(OUT, 'apple-touch-icon.png'))

# Favicon 32
make_icon(64, rounded=True, padded=False).save(os.path.join(OUT, 'favicon.ico'), sizes=[(32, 32)])

print('Ícones gerados em', os.path.join(OUT, 'icons'))
