#!/usr/bin/env bash
# Stáhne NASA/SSC textury (CC BY 4.0) do textures/.
# Spouštěj z rootu projektu: bash scripts/download-textures.sh
set -euo pipefail

mkdir -p textures
cd textures

BASE="https://www.solarsystemscope.com/textures/download"

declare -A FILES=(
  [sun.jpg]="2k_sun.jpg"
  [mercury.jpg]="2k_mercury.jpg"
  [venus.jpg]="2k_venus_surface.jpg"
  [earth.jpg]="2k_earth_daymap.jpg"
  [mars.jpg]="2k_mars.jpg"
  [jupiter.jpg]="2k_jupiter.jpg"
  [saturn.jpg]="2k_saturn.jpg"
  [saturn_ring.png]="2k_saturn_ring_alpha.png"
  [uranus.jpg]="2k_uranus.jpg"
  [neptune.jpg]="2k_neptune.jpg"
)

for local_name in "${!FILES[@]}"; do
  remote="${FILES[$local_name]}"
  if [[ -f "$local_name" ]]; then
    echo "✓ $local_name (cached)"
    continue
  fi
  echo "↓ $local_name ← $remote"
  curl -fSL --retry 3 -o "$local_name" "$BASE/$remote"
done

echo "Hotovo. Textury v textures/."
ls -la
