#!/usr/bin/env python3
"""
PWA 用のアイコン一式を書き出す。

    python3 scripts/build-icons.py [元画像]

元画像は正方形の PNG / JPEG(既定は public/icons/source.png)。
アートワークを差し替えたらこれを流すだけでよい。

maskable だけは扱いが違う。Android はアイコンを端末ごとの形に切り抜くので、
中身が中央 80% の円に収まっていないと角が欠ける。ここでは絵柄を 80% に縮めて
中央に置き、余白は元画像を拡大してぼかしたものを敷いて繋げている。
"""

import sys
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'icons'

# (ファイル名, 辺の長さ)
PLAIN = [
    ('pwa-192x192.png', 192),
    ('pwa-512x512.png', 512),
    ('apple-touch-icon-180x180.png', 180),
    ('favicon-96x96.png', 96),
]

MASKABLE = ('maskable-512x512.png', 512)
# maskable の安全領域は中央 80% の円。絵柄はその内側に収める
SAFE_RATIO = 0.8


def square(image: Image.Image) -> Image.Image:
    """中央を正方形に切り出す"""
    side = min(image.size)
    left = (image.width - side) // 2
    top = (image.height - side) // 2
    return image.crop((left, top, left + side, top + side))


def build_maskable(source: Image.Image, size: int) -> Image.Image:
    inner = round(size * SAFE_RATIO)

    # 余白は元画像を拡大してぼかしたものを敷き、切り抜かれても模様が続くようにする
    backdrop = source.resize((round(size * 1.6),) * 2, Image.LANCZOS)
    offset = (backdrop.width - size) // 2
    backdrop = backdrop.crop((offset, offset, offset + size, offset + size))
    backdrop = backdrop.filter(ImageFilter.GaussianBlur(size * 0.03))

    foreground = source.resize((inner, inner), Image.LANCZOS)
    margin = (size - inner) // 2
    backdrop.paste(foreground, (margin, margin))
    return backdrop


def main() -> int:
    source_path = Path(sys.argv[1]) if len(sys.argv) > 1 else OUT / 'source.png'
    if not source_path.exists():
        print(f'元画像が見つかりません: {source_path}', file=sys.stderr)
        return 1

    source = square(Image.open(source_path).convert('RGB'))
    if source.width < 512:
        print(f'警告: 元画像が {source.width}px しかありません。512px 以上を推奨します。', file=sys.stderr)

    OUT.mkdir(parents=True, exist_ok=True)
    for name, size in PLAIN:
        source.resize((size, size), Image.LANCZOS).save(OUT / name, optimize=True)
        print(f'  {name} ({size}x{size})')

    name, size = MASKABLE
    build_maskable(source, size).save(OUT / name, optimize=True)
    print(f'  {name} ({size}x{size}, 安全領域 {int(SAFE_RATIO * 100)}%)')

    return 0


if __name__ == '__main__':
    raise SystemExit(main())
