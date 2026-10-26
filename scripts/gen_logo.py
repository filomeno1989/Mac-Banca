#!/usr/bin/env python3
"""
Logo Mac Banca, monograma "M.B" profissional.
Gera: ícones PWA (192/512/maskable/apple), favicon.ico e TODOS os recursos
do APK (launcher legacy + round, ícone ADAPTATIVO com camadas foreground/
background, XMLs anydpi-v26, cor de fundo e splashes de todas as densidades).
Identidade: gradiente esmeralda + toldo de banca (sanefas) + tipografia bold branca.
"""
from PIL import Image, ImageDraw, ImageFont
import os

ROOT = "/home/z/my-project"
ICON_DIR = f"{ROOT}/public/icons"
APK_DIR = f"{ROOT}/apk/assets"

# Cores da identidade (emerald)
TOP = (16, 185, 129)      # #10b981
BOT = (4, 120, 87)        # #047857
WHITE = (255, 255, 255)
SHADOW = (0, 70, 52, 80)
SPLASH_TOP = (255, 255, 255)
SPLASH_BOT = (236, 253, 245)   # emerald-50
SPLASH_TEXT = (6, 78, 59)      # emerald-900

FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

# Densidades do APK: nome -> (launcher, camada adaptativa 108dp)
DENSITIES = {"mdpi": (48, 108), "hdpi": (72, 162), "xhdpi": (96, 216),
             "xxhdpi": (144, 324), "xxxhdpi": (192, 432)}

# Splashes do template do Capacitor 6 (pasta -> dimensões)
SPLASHES = {
    "drawable": (480, 320),
    "drawable-land-mdpi": (480, 320),
    "drawable-land-hdpi": (800, 480),
    "drawable-land-xhdpi": (1280, 720),
    "drawable-land-xxhdpi": (1600, 960),
    "drawable-land-xxxhdpi": (1920, 1280),
    "drawable-port-mdpi": (320, 480),
    "drawable-port-hdpi": (480, 800),
    "drawable-port-xhdpi": (720, 1280),
    "drawable-port-xxhdpi": (960, 1600),
    "drawable-port-xxxhdpi": (1280, 1920),
}

ADAPTIVE_XML = """<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
"""

BG_COLOR_XML = """<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#0A986C</color>
</resources>
"""


def vgrad(w: int, h: int, top: tuple, bot: tuple) -> Image.Image:
    """Gradiente vertical rápido: 1 coluna interpolada e depois escala."""
    col = Image.new("RGB", (1, h))
    col.putdata([
        (int(top[0] + (bot[0] - top[0]) * y / max(1, h - 1)),
         int(top[1] + (bot[1] - top[1]) * y / max(1, h - 1)),
         int(top[2] + (bot[2] - top[2]) * y / max(1, h - 1)))
        for y in range(h)
    ])
    return col.resize((w, h), Image.BILINEAR)


def gradient_bg(size: int) -> Image.Image:
    """Fundo com gradiente diagonal esmeralda + brilho suave no topo."""
    img = Image.new("RGB", (size, size), TOP)
    px = img.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * size - 2)
            r = int(TOP[0] + (BOT[0] - TOP[0]) * t)
            g = int(TOP[1] + (BOT[1] - TOP[1]) * t)
            b = int(TOP[2] + (BOT[2] - TOP[2]) * t)
            # brilho suave no canto superior
            hx = x / size - 0.25
            hy = y / size - 0.12
            d = (hx * hx + hy * hy) ** 0.5
            glow = max(0.0, 1.0 - d * 2.6) * 26
            px[x, y] = (min(255, r + int(glow)), min(255, g + int(glow)), min(255, b + int(glow)))
    return img


def draw_awning(img: Image.Image, size: int, alpha: int = 245,
                width: float = 1.0, top: float = 0.105) -> None:
    """Toldo de banca: sanefa branca no topo com semicírculos."""
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    band_y0 = int(size * top)
    band_y1 = int(size * (top + 0.10))
    col = (*WHITE, alpha)
    x0 = int(size * (1 - width) / 2)
    x1 = size - x0
    d.rectangle([x0, band_y0, x1, band_y1], fill=col)
    # semicírculos (scallops) ao longo do limite inferior da sanefa
    n = 6
    r = (x1 - x0) / (n * 2)
    for i in range(n):
        cx = x0 + (i + 0.5) * ((x1 - x0) / n)
        d.ellipse([cx - r, band_y1 - r, cx + r, band_y1 + r], fill=col)
    out = Image.alpha_composite(img.convert("RGBA"), layer)
    img.paste(out.convert("RGB"), (0, 0))


def draw_monogram(img: Image.Image, size: int, scale: float = 1.0,
                  cy_ratio: float = 0.595, shadow: bool = True) -> None:
    """Monograma M.B branco, centrado (com sombra suave opcional)."""
    text = "M.B"
    target_w = size * 0.64 * scale
    font_size = int(size * 0.44 * scale)
    for _ in range(40):
        font = ImageFont.truetype(FONT_BOLD, font_size)
        bbox = font.getbbox(text)
        w = bbox[2] - bbox[0]
        if w <= target_w:
            break
        font_size = int(font_size * 0.95)
    font = ImageFont.truetype(FONT_BOLD, font_size)
    bbox = font.getbbox(text)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    cx, cy = size / 2, size * cy_ratio
    x, y = cx - tw / 2 - bbox[0], cy - th / 2 - bbox[1]

    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    if shadow:
        off = max(1, int(size * 0.012))
        d.text((x + off, y + off), text, font=font, fill=SHADOW)
    d.text((x, y), text, font=font, fill=(*WHITE, 255))
    out = Image.alpha_composite(img.convert("RGBA"), layer)
    img.paste(out.convert("RGB"), (0, 0))


def render_logo(size: int, content_scale: float = 1.0) -> Image.Image:
    """Fundo full-bleed + toldo + monograma (content_scale reduz o monograma)."""
    img = gradient_bg(size)
    draw_awning(img, size)
    draw_monogram(img, size, scale=content_scale)
    return img


def adaptive_foreground(size: int) -> Image.Image:
    """Camada foreground do ícone adaptativo: fundo transparente, toldo e
    monograma brancos dentro da zona segura (círculo central de ~66%)."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    col = (*WHITE, 255)
    # toldo: largura 54% e topo a 32% (tudo dentro da zona segura)
    band_w = size * 0.54
    x0 = (size - band_w) / 2
    y0 = size * 0.320
    y1 = y0 + size * 0.075
    d.rectangle([x0, y0, x0 + band_w, y1], fill=col)
    n = 5
    r = band_w / (n * 2)
    for i in range(n):
        cx = x0 + (i + 0.5) * (band_w / n)
        d.ellipse([cx - r, y1 - r, cx + r, y1 + r], fill=col)
    # monograma
    text = "M.B"
    font_size = int(size * 0.19)
    for _ in range(40):
        font = ImageFont.truetype(FONT_BOLD, font_size)
        bbox = font.getbbox(text)
        if bbox[2] - bbox[0] <= size * 0.40:
            break
        font_size = int(font_size * 0.95)
    font = ImageFont.truetype(FONT_BOLD, font_size)
    bbox = font.getbbox(text)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    cx, cy = size / 2, size * 0.575
    d.text((cx - tw / 2 - bbox[0], cy - th / 2 - bbox[1]), text, font=font, fill=col)
    return img


def rounded(img: Image.Image, radius_ratio: float = 0.22) -> Image.Image:
    size = img.size[0]
    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(mask)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * radius_ratio), fill=255)
    out = img.convert("RGBA")
    out.putalpha(mask)
    return out


def circle(img: Image.Image) -> Image.Image:
    size = img.size[0]
    mask = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(mask)
    d.ellipse([0, 0, size - 1, size - 1], fill=255)
    out = img.convert("RGBA")
    out.putalpha(mask)
    return out


def render_splash(w: int, h: int, logo_1024: Image.Image) -> Image.Image:
    """Splash de abertura: fundo claro com gradiente, logotipo e nome."""
    img = vgrad(w, h, SPLASH_TOP, SPLASH_BOT).convert("RGBA")
    ls = int(min(w, h) * 0.26)
    logo = rounded(logo_1024, 0.22).resize((ls, ls), Image.LANCZOS)
    cx, cy = w // 2, int(h * 0.44)
    img.alpha_composite(logo, (cx - ls // 2, cy - ls // 2))
    d = ImageDraw.Draw(img)
    text = "Mac Banca"
    font = ImageFont.truetype(FONT_BOLD, int(ls * 0.24))
    bbox = font.getbbox(text)
    tw = bbox[2] - bbox[0]
    ty = cy + ls // 2 + int(h * 0.030)
    d.text((cx - tw / 2 - bbox[0], ty - bbox[1]), text, font=font,
           fill=(*SPLASH_TEXT, 255))
    return img.convert("RGB")


def main() -> None:
    os.makedirs(ICON_DIR, exist_ok=True)
    os.makedirs(f"{APK_DIR}/values", exist_ok=True)

    # Bases reutilizadas (render é caro: gerar 1x por tamanho)
    base1024 = render_logo(1024)
    base256 = render_logo(256)

    # PWA: quadrado arredondado com cantos transparentes
    for s in (192, 512):
        rounded(base1024).resize((s, s), Image.LANCZOS).save(f"{ICON_DIR}/icon-{s}.png")
        print(f"icon-{s}.png OK")

    # Maskable: full-bleed, conteúdo dentro da zona segura (~78%)
    maskable = render_logo(1024, content_scale=0.80)
    maskable.resize((512, 512), Image.LANCZOS).save(f"{ICON_DIR}/maskable-512.png")
    print("maskable-512.png OK")

    # Apple touch icon: full-bleed 180
    base1024.resize((180, 180), Image.LANCZOS).save(f"{ROOT}/public/apple-touch-icon.png")
    print("apple-touch-icon.png OK")

    # Favicon multi-tamanho
    base256.save(f"{ROOT}/public/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    print("favicon.ico OK")

    # APK: launcher legacy + round + ícone ADAPTATIVO (foreground/background)
    for name, (s_launch, s_layer) in DENSITIES.items():
        d = f"{APK_DIR}/mipmap-{name}"
        os.makedirs(d, exist_ok=True)
        base1024.resize((s_launch, s_launch), Image.LANCZOS).save(f"{d}/ic_launcher.png")
        circle(base1024).resize((s_launch, s_launch), Image.LANCZOS).save(f"{d}/ic_launcher_round.png")
        adaptive_foreground(s_layer).save(f"{d}/ic_launcher_foreground.png")
        gradient_bg(s_layer).save(f"{d}/ic_launcher_background.png")
        print(f"mipmap-{name} OK (launcher {s_launch}px, camadas {s_layer}px)")

    # XMLs adaptativos + cor de fallback
    anydir = f"{APK_DIR}/mipmap-anydpi-v26"
    os.makedirs(anydir, exist_ok=True)
    for xml in ("ic_launcher.xml", "ic_launcher_round.xml"):
        with open(f"{anydir}/{xml}", "w") as f:
            f.write(ADAPTIVE_XML)
    with open(f"{APK_DIR}/values/ic_launcher_background.xml", "w") as f:
        f.write(BG_COLOR_XML)
    print("mipmap-anydpi-v26 + values OK")

    # Splashes (todas as pastas do template)
    for folder, (w, h) in SPLASHES.items():
        d = f"{APK_DIR}/{folder}"
        os.makedirs(d, exist_ok=True)
        render_splash(w, h, base1024).save(f"{d}/splash.png")
    print("splashes OK (11 densidades)")

    print("Logo Mac Banca gerado com sucesso.")


if __name__ == "__main__":
    main()
