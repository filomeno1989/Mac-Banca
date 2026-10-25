#!/usr/bin/env bash
# Copia os ícones pré-gerados para o projeto Android do Capacitor
set -e
cd "$(dirname "$0")/../.."   # raiz do repo
SRC=apk/assets
DST=apk/android/app/src/main/res

for d in mipmap-mdpi mipmap-hdpi mipmap-xhdpi mipmap-xxhdpi mipmap-xxxhdpi; do
  mkdir -p "$DST/$d"
  cp "$SRC/$d/ic_launcher.png" "$DST/$d/ic_launcher.png"
  cp "$SRC/$d/ic_launcher_round.png" "$DST/$d/ic_launcher_round.png"
done
echo "✓ ícones instalados"
