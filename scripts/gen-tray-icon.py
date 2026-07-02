#!/usr/bin/env python3
"""Generate the PopDict menu-bar (tray) icon.

Writes a colored, non-template icon so macOS keeps the brand colors instead of
flattening it to a monochrome stencil. (macOS treats any tray image whose name
ends in `Template` as an alpha-only mask, discarding color — which is why the
old `trayTemplate.png` rendered as a solid blob.)

Design: the app-icon identity (dark rounded tile + amber #F5B05C highlight)
distilled to the one bold "definition highlight" that survives at 22px.

Outputs (22px @1x, 44px @2x — the macOS menu-bar sizes):
    assets/trayIcon.png
    assets/trayIcon@2x.png

Requires Pillow:  python3 -m pip install pillow
"""
from pathlib import Path

from PIL import Image, ImageDraw

ASSETS = Path(__file__).resolve().parent.parent / "assets"

AMBER     = (245, 176, 92, 255)   # #F5B05C — brand highlight
TILE_TOP  = (58, 58, 62, 255)     # charcoal gradient, top
TILE_BOT  = (22, 22, 25, 255)     # charcoal gradient, bottom
GRAY_LINE = (150, 152, 158, 255)  # muted context line
EDGE      = (120, 122, 130, 255)  # subtle edge so the tile reads on a DARK menu bar

S = 20          # supersample factor (drawn at 22*S, downscaled with LANCZOS)
BASE = 22
W = BASE * S


def _vgrad(top, bot):
    g = Image.new("RGBA", (1, W))
    for y in range(W):
        t = y / (W - 1)
        g.putpixel((0, y), tuple(int(top[i] * (1 - t) + bot[i] * t) for i in range(4)))
    return g.resize((W, W))


def _pill(draw, box, color, radius=None):
    b = [c * S for c in box]
    r = (radius * S) if radius is not None else (b[3] - b[1]) / 2
    draw.rounded_rectangle(b, radius=r, fill=color)


def render():
    img = Image.new("RGBA", (W, W), (0, 0, 0, 0))
    inset, radius = 1.0 * S, 5.0 * S
    box = [inset, inset, W - inset, W - inset]

    mask = Image.new("L", (W, W), 0)
    ImageDraw.Draw(mask).rounded_rectangle(box, radius=radius, fill=255)
    img.paste(_vgrad(TILE_TOP, TILE_BOT), (0, 0), mask)

    d = ImageDraw.Draw(img)
    d.rounded_rectangle(box, radius=radius, outline=EDGE, width=int(0.5 * S))
    _pill(d, [5.5, 7.2, 16.5, 9.0], GRAY_LINE, radius=0.9)   # context line
    _pill(d, [5.5, 11.4, 16.5, 15.2], AMBER, radius=1.9)     # bold amber highlight
    return img


def main():
    art = render()
    art.resize((44, 44), Image.LANCZOS).save(ASSETS / "trayIcon@2x.png")
    art.resize((22, 22), Image.LANCZOS).save(ASSETS / "trayIcon.png")
    print(f"wrote {ASSETS / 'trayIcon.png'} (22px) and trayIcon@2x.png (44px)")


if __name__ == "__main__":
    main()
