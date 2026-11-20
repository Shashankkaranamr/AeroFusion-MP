"""Diagram toolkit for the report figures (approved style, 2026-11-20).

Rules: one blue (#2F6EB5) for every line, arrow, outline, shape and coloured label; black for titles, grey for
sub-lines; colour isometric components drawn large; no boxes around components; groups are dotted blue outlines;
transparent background; text sized for a 1400 px canvas placed at full A4 text width (~6.3 in), titles 24-27 px.
Rendered to PNG (with alpha) at 3x by headless Chrome."""

from __future__ import annotations

import base64
import html
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]            # .../Reports/Image generation
OUT = ROOT / "Final images"
COMP = OUT / "components"
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
FONT = "'Segoe UI', 'Helvetica Neue', Arial, sans-serif"
MONO = "Consolas, 'Courier New', monospace"

BLUE = "#2F6EB5"      # the only accent colour: lines, arrows, outlines, shapes, coloured labels
INK = "#1A1A1A"       # titles and body text
SOFT = "#5E5E5E"      # sub-lines
SW = 2.4              # main stroke width
T, S = 25, 19.5       # default title / sub sizes


def esc(s: str) -> str:
    return html.escape(str(s), quote=True)


class Diagram:
    def __init__(self, w: int, h: int):
        self.w, self.h = w, h
        self.items: list[str] = []
        self.defs: dict[str, str] = {}

    def add(self, s: str) -> None:
        self.items.append(s)

    # ---------- markers ----------
    def _marker(self, kind: str = "arrow") -> str:
        mid = f"m{kind}"
        if mid in self.defs:
            return mid
        c = BLUE
        shapes = {
            "arrow": ('0 0 10 10', 9, 5, 13, f'<path d="M0,0.5 L10,5 L0,9.5 L2.4,5 Z" fill="{c}"/>'),
            "open": ('0 0 10 10', 9.5, 5, 14, f'<path d="M0.5,0.5 L9.5,5 L0.5,9.5" fill="none" stroke="{c}" stroke-width="1.4"/>'),
            "tri": ('0 0 13 12', 12, 6, 17, f'<path d="M0.6,0.6 L12,6 L0.6,11.4 Z" fill="none" stroke="{c}" stroke-width="1.2"/>'),
            "diamond": ('0 0 14 12', 0.5, 6, 18, f'<path d="M0,6 L7,0.5 L14,6 L7,11.5 Z" fill="{c}"/>'),
            "odiamond": ('0 0 14 12', 0.5, 6, 18, f'<path d="M0.6,6 L7,0.8 L13.4,6 L7,11.2 Z" fill="none" stroke="{c}" stroke-width="1.2"/>'),
        }
        vb, rx, ry, sz, shape = shapes[kind]
        self.defs[mid] = (f'<marker id="{mid}" viewBox="{vb}" refX="{rx}" refY="{ry}" markerWidth="{sz}" markerHeight="{sz}" '
                          f'orient="auto-start-reverse" markerUnits="userSpaceOnUse">{shape}</marker>')
        return mid

    # ---------- primitives ----------
    def text(self, x, y, s, size=T, weight=400, anchor="middle", color=INK, italic=False, family=None, rotate=None):
        st = ' font-style="italic"' if italic else ""
        rot = f' transform="rotate({rotate} {x} {y})"' if rotate is not None else ""
        self.add(f'<text x="{x}" y="{y}" font-family="{family or FONT}" font-size="{size}" font-weight="{weight}" '
                 f'text-anchor="{anchor}" fill="{color}"{st}{rot} dominant-baseline="middle">{esc(s)}</text>')

    def lines(self, x, y, rows, size=S, gap=None, anchor="middle", color=INK, weight=400, family=None, italic=False):
        gap = gap or size * 1.3
        y0 = y - gap * (len(rows) - 1) / 2
        for i, r in enumerate(rows):
            self.text(x, y0 + i * gap, r, size=size, anchor=anchor, color=color, weight=weight, family=family, italic=italic)

    def rect(self, x, y, w, h, r=8, sw=2, dash=None, fill="none"):
        d = f' stroke-dasharray="{dash}"' if dash else ""
        self.add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" stroke="{BLUE}" stroke-width="{sw}"{d}/>')

    def shape(self, d_attr, sw=2, fill="none", dash=None):
        ds = f' stroke-dasharray="{dash}"' if dash else ""
        self.add(f'<path d="{d_attr}" fill="{fill}" stroke="{BLUE}" stroke-width="{sw}" stroke-linejoin="round"{ds}/>')

    def circle(self, cx, cy, r, sw=2, fill="none"):
        self.add(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="{fill}" stroke="{BLUE}" stroke-width="{sw}"/>')

    def line(self, pts, sw=SW, dash=None, head="end", kind="arrow", tail=None, r=10):
        """Blue polyline with rounded corners; head in end|start|both|None; tail = marker kind at the start."""
        d = f' stroke-dasharray="{dash}"' if dash else ""
        ms = ""
        if head in ("end", "both"):
            ms += f' marker-end="url(#{self._marker(kind)})"'
        if head in ("start", "both") and not tail:
            ms += f' marker-start="url(#{self._marker(kind)})"'
        if tail:
            ms += f' marker-start="url(#{self._marker(tail)})"'
        self.add(f'<path d="{_rounded(pts, r)}" fill="none" stroke="{BLUE}" stroke-width="{sw}" stroke-linejoin="round" '
                 f'stroke-linecap="round"{d}{ms}/>')

    def label(self, x, y, s, size=17, italic=False, anchor="middle", weight=400, color=BLUE):
        """Blue text on a line, on a paper-white plate so the line does not show through."""
        w = _tw(s, size) + 10
        x0 = x - w / 2 if anchor == "middle" else (x - 5 if anchor == "start" else x - w + 5)
        self.add(f'<rect x="{x0:.1f}" y="{y - size * 0.72:.1f}" width="{w:.1f}" height="{size * 1.44:.1f}" fill="#FFFFFF"/>')
        self.text(x, y, s, size=size, color=color, italic=italic, anchor=anchor, weight=weight)

    def icon(self, name, x, y, w, h):
        """A colour isometric component (Final images/components/<name>_color.svg)."""
        f = COMP / f"{name}_color.svg"
        data = base64.b64encode(f.read_bytes()).decode()
        self.add(f'<image x="{x}" y="{y}" width="{w}" height="{h}" preserveAspectRatio="xMidYMid meet" '
                 f'href="data:image/svg+xml;base64,{data}"/>')

    # ---------- composites ----------
    def node(self, x, y, title, sub=None, size=T, sub_size=S):
        """Text-only node centred on (x, y): black title, optional grey sub-line."""
        if sub:
            self.text(x, y - size * 0.68, title, size=size, weight=600)
            self.text(x, y + sub_size * 0.78, sub, size=sub_size, color=SOFT)
        else:
            self.text(x, y, title, size=size, weight=600)

    def item(self, icon, cx, y, w, h, title, sub=None, gap=26, size=T, sub_size=S):
        """A large component with its label directly underneath."""
        self.icon(icon, cx - w / 2, y, w, h)
        self.node(cx, y + h + gap, title, sub, size=size, sub_size=sub_size)

    def box(self, x, y, w, h, title, sub=None, r=10, size=T - 3, sub_size=S - 1, dash=None):
        """Thin blue outline block, used only where the notation needs a shape (flowchart, model blocks)."""
        self.rect(x, y, w, h, r=r, dash=dash)
        if sub:
            self.text(x + w / 2, y + h / 2 - size * 0.55, title, size=size, weight=600)
            self.text(x + w / 2, y + h / 2 + sub_size * 0.8, sub, size=sub_size, color=SOFT)
        else:
            self.text(x + w / 2, y + h / 2, title, size=size, weight=600)
        return (x, y, w, h)

    def zone(self, x, y, w, h, label=None, r=16, right=False):
        """Dotted blue grouping outline with a blue caption."""
        self.add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="none" stroke="{BLUE}" '
                 f'stroke-width="1.6" stroke-dasharray="1.5 5" stroke-linecap="round"/>')
        if label:
            if right:
                self.text(x + w - 16, y + 24, label.upper(), size=16.5, weight=700, anchor="end", color=BLUE)
            else:
                self.text(x + 16, y + 24, label.upper(), size=16.5, weight=700, anchor="start", color=BLUE)

    def divider(self, pts):
        self.add(f'<path d="{_rounded(pts, 0)}" fill="none" stroke="{BLUE}" stroke-width="1.6" stroke-dasharray="1.5 5" stroke-linecap="round"/>')

    def caption(self, x, y, s, anchor="start"):
        self.text(x, y, s.upper(), size=16.5, weight=700, anchor=anchor, color=BLUE)

    # ---------- output ----------
    def svg(self) -> str:
        return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" viewBox="0 0 {self.w} {self.h}">'
                f'<defs>{"".join(self.defs.values())}</defs>{"".join(self.items)}</svg>')

    def save(self, name: str, scale: float = 3.0) -> Path:
        (OUT / "svg").mkdir(parents=True, exist_ok=True)
        (OUT / "svg" / f"{name}.svg").write_text(self.svg(), encoding="utf-8")
        page = OUT / "svg" / f"_{name}.html"
        page.write_text('<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;'
                        f'background:transparent}}svg{{display:block}}</style></head><body>{self.svg()}</body></html>', encoding="utf-8")
        png = OUT / f"{name}.png"
        subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
                        "--default-background-color=00000000", f"--force-device-scale-factor={scale}",
                        f"--window-size={self.w},{self.h}", f"--screenshot={png}", page.as_uri()],
                       check=True, capture_output=True, timeout=120)
        page.unlink()
        print("saved", png.name)
        return png


def _tw(s: str, size: float) -> float:
    wide = sum(1 for c in s if c in "MWmw@%")
    narrow = sum(1 for c in s if c in "ilIjt.,:;|'!()[] /")
    return size * (0.55 * (len(s) - wide - narrow) + 0.85 * wide + 0.3 * narrow)


def _rounded(pts, r):
    if len(pts) == 2 or r <= 0:
        return "M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in pts)
    out = [f"M{pts[0][0]:.1f},{pts[0][1]:.1f}"]
    for i in range(1, len(pts) - 1):
        (x0, y0), (x1, y1), (x2, y2) = pts[i - 1], pts[i], pts[i + 1]
        d1 = ((x1 - x0) ** 2 + (y1 - y0) ** 2) ** 0.5 or 1
        d2 = ((x2 - x1) ** 2 + (y2 - y1) ** 2) ** 0.5 or 1
        rr = min(r, d1 / 2, d2 / 2)
        ax, ay = x1 - (x1 - x0) / d1 * rr, y1 - (y1 - y0) / d1 * rr
        bx, by = x1 + (x2 - x1) / d2 * rr, y1 + (y2 - y1) / d2 * rr
        out.append(f"L{ax:.1f},{ay:.1f} Q{x1:.1f},{y1:.1f} {bx:.1f},{by:.1f}")
    out.append(f"L{pts[-1][0]:.1f},{pts[-1][1]:.1f}")
    return " ".join(out)
