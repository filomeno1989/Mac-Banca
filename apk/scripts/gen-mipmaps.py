#!/usr/bin/env python3
"""Gera os ícones mipmap do APK a partir do ícone PWA 512."""
import os
from PIL import Image, ImageDraw

SRC = '/home/z/my-project/public/icons/icon-512.png'
OUT = '/home/z/my-project/apk/assets'
SIZES = {'mipmap-mdpi': 48, 'mipmap-hdpi': 72, 'mipmap-xhdpi': 96, 'mipmap-xxhdpi': 144, 'mipmap-xxxhdpi': 192}

base = Image.open(SRC).convert('RGBA')

for d, size in SIZES.items():
    os.makedirs(os.path.join(OUT, d), exist_ok=True)
    icon = base.resize((size, size), Image.LANCZOS)
    icon.save(os.path.join(OUT, d, 'ic_launcher.png'))
    # round: círculo recortado com fundo verde (para o formato redondo)
    round_bg = Image.new('RGBA', (size, size), (5, 150, 105, 255))
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, size - 1, size - 1], fill=255)
    rounded = base.resize((size, size), Image.LANCZOS)
    round_bg.paste(rounded, (0, 0), mask)
    round_bg.save(os.path.join(OUT, d, 'ic_launcher_round.png'))
    print(d, size)
print('OK')
