#!/usr/bin/env bash
# Copia os recursos de marca gerados por scripts/gen_logo.py para o projeto
# Android do Capacitor: launcher legacy + round, ícone ADAPTATIVO (foreground
# e background), XMLs anydpi-v26, cor de fundo e splashes de todas as densidades.
set -e
cd "$(dirname "$0")/../.."   # raiz do repo
SRC=apk/assets
DST=apk/android/app/src/main/res

# 1) mipmaps: launcher, round e camadas do ícone adaptativo
for d in mipmap-mdpi mipmap-hdpi mipmap-xhdpi mipmap-xxhdpi mipmap-xxxhdpi; do
  mkdir -p "$DST/$d"
  for f in ic_launcher.png ic_launcher_round.png ic_launcher_foreground.png ic_launcher_background.png; do
    cp "$SRC/$d/$f" "$DST/$d/"
  done
done

# 2) XMLs do ícone adaptativo (Android 8+ usa ESTAS camadas, não o PNG legacy)
mkdir -p "$DST/mipmap-anydpi-v26"
cp "$SRC/mipmap-anydpi-v26/ic_launcher.xml" "$DST/mipmap-anydpi-v26/"
cp "$SRC/mipmap-anydpi-v26/ic_launcher_round.xml" "$DST/mipmap-anydpi-v26/"

# 3) cor de fallback referenciada em values (por temas/launchers antigos)
mkdir -p "$DST/values"
cp "$SRC/values/ic_launcher_background.xml" "$DST/values/"

# 4) splash de abertura (todas as orientações e densidades)
for f in "$SRC"/drawable*/splash.png; do
  dir=$(basename "$(dirname "$f")")
  mkdir -p "$DST/$dir"
  cp "$f" "$DST/$dir/splash.png"
done

echo "OK: launcher, ícone adaptativo, cor de fundo e splash instalados"
