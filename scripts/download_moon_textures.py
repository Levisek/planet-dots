#!/usr/bin/env python3
"""Stáhne 19 moon textur do ./textures/ jako <moon>.jpg.

Zdroje:
- Luna: Solar System Scope (CC BY 4.0).
- Ostatní: Wikimedia Commons (licence viz Wikipedia-link v atribuci).

PNG se automaticky konvertují na JPG přes Pillow.

Usage: python3 scripts/download_moon_textures.py
"""
import os
import sys
import urllib.request
from pathlib import Path
from io import BytesIO

try:
    from PIL import Image
except ImportError:
    sys.exit("Chybí Pillow. Nainstaluj: python3 -m pip install Pillow")

ROOT = Path(__file__).resolve().parent.parent
TEXDIR = ROOT / "textures"
TEXDIR.mkdir(exist_ok=True)

UA = "Mozilla/5.0 (compatible; DotsEduApp/1.0; https://github.com/dots)"

URLS = {
    "luna":      "https://www.solarsystemscope.com/textures/download/2k_moon.jpg",
    "phobos":    "https://upload.wikimedia.org/wikipedia/commons/5/5c/Phobos_colour_2008.jpg",
    "deimos":    "https://upload.wikimedia.org/wikipedia/commons/8/86/NASA-Deimos-MarsMoon-20090221.jpg",
    "io":        "https://upload.wikimedia.org/wikipedia/commons/c/c2/Io_mosaic_in_true_color.png",
    "europa":    "https://upload.wikimedia.org/wikipedia/commons/b/b3/Europa_-_Perijove_45_%28cropped%29.png",
    "ganymede":  "https://upload.wikimedia.org/wikipedia/commons/2/21/Ganymede_-_Perijove_34_Composite.png",
    "callisto":  "https://upload.wikimedia.org/wikipedia/commons/c/c6/Callisto_VGR2_C2060635_OGB.png",
    "titan":     "https://upload.wikimedia.org/wikipedia/commons/f/fe/Titan_in_true_color_by_Kevin_M._Gill.jpg",
    "rhea":      "https://upload.wikimedia.org/wikipedia/commons/a/ab/PIA07763_Rhea_full_globe5.jpg",
    "iapetus":   "https://upload.wikimedia.org/wikipedia/commons/4/49/Iapetus_as_seen_by_Cassini_True_Color.png",
    "dione":     "https://upload.wikimedia.org/wikipedia/commons/4/42/Dione_in_natural_light.jpg",
    "tethys":    "https://upload.wikimedia.org/wikipedia/commons/8/87/Tethys_-_Rev_15_%2837267740632%29.png",
    "enceladus": "https://upload.wikimedia.org/wikipedia/commons/8/83/PIA17202_-_Approaching_Enceladus.jpg",
    "mimas":     "https://upload.wikimedia.org/wikipedia/commons/b/bc/Mimas_Cassini.jpg",
    "miranda":   "https://upload.wikimedia.org/wikipedia/commons/c/c2/Miranda_mosaic_in_color_-_Voyager_2.png",
    "ariel":     "https://upload.wikimedia.org/wikipedia/commons/8/84/Ariel_in_monochrome.jpg",
    "umbriel":   "https://upload.wikimedia.org/wikipedia/commons/2/2f/PIA00040_Umbrielx2.47.jpg",
    "titania":   "https://upload.wikimedia.org/wikipedia/commons/f/f4/Titania_VGR2_C2684315.png",
    "oberon":    "https://upload.wikimedia.org/wikipedia/commons/6/6d/Oberon_in_true_color_by_Kevin_M._Gill.jpg",
}


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()


def save_as_jpg(data: bytes, out_path: Path) -> int:
    """Uloží data jako JPG. Pokud jsou PNG → konvertuje, jinak zapisuje přímo."""
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        img = Image.open(BytesIO(data)).convert("RGB")
        # Max 2048px na delší straně (úspora, viewport stejně nezobrazí víc).
        img.thumbnail((2048, 2048), Image.Resampling.LANCZOS)
        img.save(out_path, "JPEG", quality=88, optimize=True)
    elif data[:3] == b"\xff\xd8\xff":
        # JPG už je v cílovém formátu — jen ev. zmenši.
        img = Image.open(BytesIO(data)).convert("RGB")
        if max(img.size) > 2048:
            img.thumbnail((2048, 2048), Image.Resampling.LANCZOS)
            img.save(out_path, "JPEG", quality=88, optimize=True)
        else:
            out_path.write_bytes(data)
    else:
        raise ValueError(f"neznámý formát, magic bytes: {data[:8]!r}")
    return out_path.stat().st_size


def main() -> int:
    errors = 0
    for name, url in URLS.items():
        out = TEXDIR / f"{name}.jpg"
        if out.exists() and out.stat().st_size > 1000:
            print(f"[ok]  {name}.jpg (existuje, {out.stat().st_size} B) skip")
            continue
        try:
            data = fetch(url)
            size = save_as_jpg(data, out)
            print(f"[ok]  {name}.jpg ({size} B) <- {url[:70]}")
        except Exception as e:
            print(f"[err] {name}: {e}")
            errors += 1
    if errors:
        print(f"\n{errors}/19 selhalo - zkontroluj URL nebo stahni rucne.")
        return 1
    print(f"\n19/19 textur stazeno do {TEXDIR}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
