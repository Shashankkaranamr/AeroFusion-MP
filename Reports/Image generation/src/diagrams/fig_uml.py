"""Fig 4.3 use case, Fig 4.4 class diagram, Fig 4.5 / 4.6 sequence diagrams. Approved style: blue lines and
shapes, black text, 1400 px wide."""

from dg import Diagram, BLUE, INK, SOFT, MONO

# ------------------------------------------------------------------ use case


def actor(d, x, y, name):
    d.add(f'<g stroke="{BLUE}" stroke-width="2.4" fill="none" stroke-linecap="round">'
          f'<circle cx="{x}" cy="{y}" r="16"/><line x1="{x}" y1="{y + 16}" x2="{x}" y2="{y + 64}"/>'
          f'<line x1="{x - 30}" y1="{y + 32}" x2="{x + 30}" y2="{y + 32}"/>'
          f'<line x1="{x}" y1="{y + 64}" x2="{x - 22}" y2="{y + 98}"/><line x1="{x}" y1="{y + 64}" x2="{x + 22}" y2="{y + 98}"/></g>')
    d.text(x, y + 124, name, size=22, weight=600)


def uc(d, cx, cy, s, rx=170, ry=33):
    d.add(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{ry}" fill="none" stroke="{BLUE}" stroke-width="2"/>')
    d.text(cx, cy, s, size=20)
    return (cx, cy, rx)


def use_case():
    d = Diagram(1400, 960)
    d.zone(225, 8, 440, 944, "Live platform")
    d.zone(735, 8, 440, 944, "Research pipeline")
    P = {}
    ys = [95, 205, 315, 425, 535, 645, 755, 865]
    for (k, s), y in zip([("live", "View live air quality"), ("city", "View city history"), ("ai", "Ask AI about a city"),
                          ("whatif", "Run What-if scenario"), ("src", "Inspect data sources"), ("fc", "View model forecast"),
                          ("ground", "Ground on live data"), ("snap", "Refresh snapshot")], ys):
        P[k] = uc(d, 445, y, s)
    for (k, s), y in zip([("dl", "Download data"), ("build", "Build dataset"), ("train", "Train models"), ("val", "Validate and tune"),
                          ("freeze", "Declare freeze"), ("final", "Run final test"), ("lock", "Verify SPLITS.lock"), ("tab", "Make tables, figures")], ys):
        P[k] = uc(d, 955, y, s)
    L = lambda k: (P[k][0] - P[k][2], P[k][1])
    R = lambda k: (P[k][0] + P[k][2], P[k][1])
    actor(d, 100, 60, "Citizen")
    actor(d, 100, 400, "Researcher")
    actor(d, 100, 720, "LLM provider")
    actor(d, 1300, 330, "Team")
    actor(d, 1300, 720, "Data providers")
    for k in ("live", "city", "ai", "whatif"):
        d.line([(132, 100), L(k)], head=None, sw=1.6)
    for k in ("city", "src", "fc"):
        d.line([(132, 440), L(k)], head=None, sw=1.6)
    d.line([(132, 760), L("ground")], head=None, sw=1.6)
    for k in ("dl", "build", "train", "val", "freeze", "final", "tab"):
        d.line([(1268, 370), R(k)], head=None, sw=1.6)
    d.line([(1268, 755), (1200, 755), (1200, 30), (955, 30), (955, 61)], head=None, sw=1.6)
    d.line([(1268, 775), (1215, 775), (1215, 940), (445, 940), (445, 898)], head=None, sw=1.6)
    dash = "7 5"
    d.line([(615, 315), (690, 315), (690, 755), (615, 755)], dash=dash, kind="open", sw=1.8)
    d.label(690, 540, "«include»", size=16, italic=True)
    d.line([(615, 95), (712, 95), (712, 865), (615, 865)], dash=dash, kind="open", sw=1.8)
    d.label(712, 810, "«include»", size=16, italic=True)
    d.line([(955, 678), (955, 720)], dash=dash, kind="open", sw=1.8)
    d.line([(785, 645), (615, 645)], dash=dash, kind="open", sw=1.8)
    d.label(740, 620, "frozen model", size=16, italic=True)
    d.save("fig4_3_use_case")


# ------------------------------------------------------------------ class diagram


def cls(d, x, y, w, name, attrs, methods, stereo=None):
    lh, fs = 24, 17
    top = 56 if stereo else 40
    h = top + max(1, len(attrs)) * lh + 14 + max(1, len(methods)) * lh + 14
    d.rect(x, y, w, h, r=3, sw=2)
    if stereo:
        d.text(x + w / 2, y + 17, f"«{stereo}»", size=15, color=SOFT, italic=True)
        d.text(x + w / 2, y + 39, name, size=21, weight=700)
    else:
        d.text(x + w / 2, y + 21, name, size=21, weight=700)
    d.add(f'<line x1="{x}" y1="{y + top}" x2="{x + w}" y2="{y + top}" stroke="{BLUE}" stroke-width="1.6"/>')
    yy = y + top + 8 + lh / 2
    for a in attrs:
        d.text(x + 12, yy, a, size=fs, anchor="start", family=MONO)
        yy += lh
    if not attrs:
        yy += lh
    sep = yy - lh / 2 + 4
    d.add(f'<line x1="{x}" y1="{sep}" x2="{x + w}" y2="{sep}" stroke="{BLUE}" stroke-width="1.6"/>')
    yy = sep + 8 + lh / 2
    for m in methods:
        d.text(x + 12, yy, m, size=fs, anchor="start", family=MONO)
        yy += lh
    return (x, y, w, h)


def class_diagram():
    d = Diagram(1400, 1170)
    d.zone(8, 8, 1384, 900, "ml / aerofusion_ml", right=True)
    itf = cls(d, 540, 40, 320, "ForecastModel", [], ["forward(batch)"], "interface")
    cfg = cls(d, 30, 200, 330, "Config", ["graph, temporal", "wavelet, convlstm", "gating, hidden=64"], ["rung(name)"], "dataclass")
    mw = cls(d, 540, 200, 320, "MWAFN", ["cfg: Config", "A_static, bearing"], ["forward(batch)"], "nn.Module")
    nb = cls(d, 1040, 200, 330, "Neural baselines", ["LSTM, CNN-LSTM", "PM25GNN, GWN"], ["forward(batch)"], "nn.Module")
    W, xs, py = 262, [24, 296, 568, 840, 1112], 480
    parts = [("CausalSWT", ["db4, 3 levels"], ["forward(x)"]), ("GroupGate", ["7 groups"], ["forward(parts)"]),
             ("Transformer", ["2 layers, causal"], ["forward(h)"]), ("DiffusionConv", ["K=2, adaptive"], ["forward(H, A)"]),
             ("GridContext", ["ConvLSTM, 16"], ["forward(grid)"])]
    for x, (n, a, m) in zip(xs, parts):
        cls(d, x, py, W, n, a, m)
    cls(d, 1112, 660, W, "ConvLSTMCell", ["Conv2d, 4 gates"], ["forward(x, h, c)"])
    cls(d, 24, 660, 330, "WindowDataset", ["arrays, issue times", "setting S-A|S-B|S-C"], ["__getitem__(i)"], "torch Dataset")
    cls(d, 410, 675, 280, "Stats", ["train-only mean/std"], ["y_fwd, y_inv"])
    na = cls(d, 745, 675, 300, "NodeArrays", ["x_node, m_node, y"], ["sample(t0)"])
    ib = itf[1] + itf[3]
    d.line([(700, 200), (700, ib)], dash="8 6", kind="tri")
    d.line([(1205, 200), (1205, 165), (790, 165), (790, ib)], dash="8 6", kind="tri")
    d.line([(360, 270), (540, 270)], kind="open")
    mb = mw[1] + mw[3]
    bus = mb + 50
    d.line([(700, mb), (700, bus)], head=None, tail="diamond")
    d.line([(xs[0] + W / 2, bus), (xs[-1] + W / 2, bus)], head=None)
    for x in xs:
        d.line([(x + W / 2, bus), (x + W / 2, py)], head=None)
    d.label(990, bus, "0..1 each, by rung", size=16, italic=True)
    d.line([(1243, py + 130), (1243, 660)], head=None, tail="diamond")
    d.line([(354, 750), (410, 750)], head=None, tail="odiamond")
    d.line([(354, 800), (380, 800), (380, 880), (895, 880), (895, na[1] + na[3])], head=None, tail="odiamond")
    d.line([(24, 720), (16, 720), (16, 180), (620, 180), (620, 200)], dash="8 6", kind="open")
    d.label(330, 180, "batch dict", size=16, italic=True)
    d.zone(8, 922, 1384, 240, "backend / app", right=True)
    cls(d, 30, 955, 330, "LiveService", ["interval = 12 h"], ["refresh(), _fuse()"])
    cls(d, 400, 955, 300, "SourceResult", ["id, ok, latency_ms"], ["(data)"], "dataclass")
    cls(d, 740, 955, 300, "sources", [], ["fetch_air_quality()", "fetch_weather()"], "module")
    cls(d, 1080, 955, 290, "ai", [], ["insights()", "chat_stream()"], "module")
    d.line([(360, 1025), (400, 1025)], head=None, tail="diamond")
    d.line([(740, 1025), (700, 1025)], dash="8 6", kind="open")
    d.line([(1080, 1025), (1040, 1025)], dash="8 6", head=None)
    d.save("fig4_4_class_diagram")


# ------------------------------------------------------------------ sequence diagrams


def seq(name, parts, msgs, height, width=1400):
    d = Diagram(width, height)
    n = len(parts)
    gap = (width - 20) / n
    xs = [10 + gap * (i + 0.5) for i in range(n)]
    top, bottom = 10, height - 10
    for x, p in zip(xs, parts):
        d.rect(x - gap / 2 + 8, top, gap - 16, 62, r=6, sw=2)
        d.lines(x, top + 31, p.split("\n"), size=18, weight=600, gap=21)
        d.line([(x, top + 62), (x, bottom)], dash="4 6", head=None, sw=1.4)
    y = top + 112
    for m in msgs:
        kind = m[0]
        if kind == "loop":
            _, a, b, label, rows = m
            x0, x1 = xs[a] - gap / 2 + 6, xs[b] + gap / 2 - 6
            d.rect(x0, y - 22, x1 - x0, rows * 50 + 56, r=2, sw=1.8)
            w = len(label) * 9.5 + 30
            d.shape(f"M{x0},{y - 22} h{w} v22 l-10,10 h-{w - 10} Z", sw=1.8)
            d.text(x0 + 10, y - 6, label, size=17, weight=600, anchor="start", color=BLUE)
            y += 46
            continue
        if kind == "note":
            _, a, b, text = m
            y += 6
            d.text((xs[a] + xs[b]) / 2, y, text, size=18, italic=True, color=BLUE)
            d.divider([(xs[a] - gap / 2 + 14, y + 20), (xs[b] + gap / 2 - 14, y + 20)])
            y += 54
            continue
        _, a, b, label = m
        if a == b:
            x = xs[a]
            d.line([(x + 4, y - 10), (x + 60, y - 10), (x + 60, y + 14), (x + 6, y + 14)], sw=2, r=4)
            d.text(x + 72, y + 2, label, size=18, anchor="start")
            y += 50
            continue
        ret = kind == "ret"
        x0, x1 = xs[a] + (5 if b > a else -5), xs[b] + (-5 if b > a else 5)
        d.line([(x0, y), (x1, y)], sw=2, dash="8 6" if ret else None, kind="open" if ret else "arrow")
        d.label((x0 + x1) / 2, y - 16, label, size=18, color=SOFT if ret else INK, italic=ret)
        y += 50
    d.save(name)


def seq_live():
    parts = ["Scheduler", "LiveService", "Fetchers", "External\nAPIs", "Archive", "FastAPI", "Browser", "LLM chain"]
    msgs = [("loop", 0, 4, "loop every 12 h", 7),
            ("call", 0, 1, "refresh()"), ("call", 1, 2, "fetch all"), ("call", 2, 3, "HTTPS GET"),
            ("ret", 3, 2, "data / timeout"), ("ret", 2, 1, "results"), ("self", 1, 1, "fuse 33 cities"),
            ("call", 1, 4, "save"),
            ("note", 5, 6, "user opens the dashboard"),
            ("call", 6, 5, "GET snapshot"), ("call", 5, 1, "latest"), ("ret", 1, 5, "snapshot"), ("ret", 5, 6, "JSON"),
            ("call", 6, 5, "chat"), ("call", 5, 7, "prompt"), ("ret", 7, 5, "tokens"), ("ret", 5, 6, "text stream")]
    seq("fig4_5_sequence_live", parts, msgs, 975)


def seq_train():
    parts = ["Team", "Download\n+ build", "Data\nservices", "Dataset +\nSPLITS.lock", "run_ladder", "train.py", "Run folder", "final_eval"]
    msgs = [("call", 0, 1, "download"), ("call", 1, 2, "requests"), ("ret", 2, 1, "files + sha256"), ("call", 1, 3, "QC, features"),
            ("note", 0, 3, "feature freeze"),
            ("call", 0, 4, "start ladder"),
            ("loop", 4, 6, "loop each config x seed", 5),
            ("call", 4, 5, "train config"), ("call", 5, 3, "train + val"), ("self", 5, 5, "epochs"),
            ("call", 5, 6, "ckpt, metrics"), ("ret", 6, 4, "done"),
            ("note", 0, 6, "model freeze"),
            ("call", 0, 7, "final_eval"), ("call", 7, 3, "test, once"), ("call", 7, 6, "frozen models"), ("ret", 7, 0, "test metrics")]
    seq("fig4_6_sequence_training", parts, msgs, 975)


if __name__ == "__main__":
    use_case()
    class_diagram()
    seq_live()
    seq_train()
