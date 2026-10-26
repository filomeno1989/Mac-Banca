#!/usr/bin/env python3
"""
Logo Mac Banca — monograma "M.B" profissional.
Gera: ícones PWA (192/512/maskable/apple), favicon.ico e mipmaps Android (APK).
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

FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


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


def draw_awning(img: Image.Image, size: int, alpha: int = 245) -> None:
    """Toldo de banca: sanefa branca no topo com semicírculos."""
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    band_y0 = int(size * 0.105)
    band_y1 = int(size * 0.205)
    col = (*WHITE, alpha)
    d.rectangle([0, band_y0, size, band_y1], fill=col)
    # semicírculos (scallops) ao longo do limite inferior da sanefa
    n = 6
    r = size / (n * 2)
    for i in range(n):
        cx = (i + 0.5) * (size / n)
        d.ellipse([cx - r, band_y1 - r, cx + r, band_y1 + r], fill=col)
    img.paste(Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB"), (0, 0))


def draw_monogram(img: Image.Image, size: int, scale: float = 1.0) -> None:
    """Monograma M.B branco com sombra suave, centrado."""
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
    cx, cy = size / 2, size * 0.595
    x, y = cx - tw / 2 - bbox[0], cy - th / 2 - bbox[1]

    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    off = max(1, int(size * 0.012))
    d.text((x + off, y + off), text, font=font, fill=SHADOW)
    d.text((x, y), text, font=font, fill=(*WHITE, 255))
    img.paste(Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB"), (0, 0))


def render_logo(size: int, content_scale: float = 1.0) -> Image.Image:
    """Fundo full-bleed + toldo + monograma (content_scale reduz o monograma)."""
    img = gradient_bg(size)
    draw_awning(img, size)
    draw_monogram(img, size, scale=content_scale)
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


def main() -> None:
    os.makedirs(ICON_DIR, exist_ok=True)

    # PWA: quadrado arredondado com cantos transparentes
    for s in (192, 512):
        base = render_logo(1024)
        rounded(base).resize((s, s), Image.LANCZOS).save(f"{ICON_DIR}/icon-{s}.png")
        print(f"icon-{s}.png OK")

    # Maskable: full-bleed, conteúdo dentro da zona segura (~78%)
    maskable = render_logo(1024, content_scale=0.80)
    maskable.resize((512, 512), Image.LANCZOS).save(f"{ICON_DIR}/maskable-512.png")
    print("maskable-512.png OK")

    # Apple touch icon: full-bleed 180
    render_logo(1024).resize((180, 180), Image.LANCZOS).save(f"{ROOT}/public/apple-touch-icon.png")
    print("apple-touch-icon.png OK")

    # Favicon multi-tamanho
    fav_base = render_logo(256)
    fav_base.save(f"{ROOT}/public/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    print("favicon.ico OK")

    # APK mipmaps: ic_launcher (full-bleed) + ic_launcher_round (círculo)
    densities = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
    for name, s in densities.items():
        d = f"{APK_DIR}/mipmap-{name}"
        os.makedirs(d, exist_ok=True)
        base = render_logo(1024)
        base.resize((s, s), Image.LANCZOS).save(f"{d}/ic_launcher.png")
        circle(base).resize((s, s), Image.LANCZOS).save(f"{d}/ic_launcher_round.png")
        print(f"mipmap-{name} OK ({s}px)")

    print("Logo Mac Banca gerado com sucesso.")


if __name__ == "__main__":
    main()
