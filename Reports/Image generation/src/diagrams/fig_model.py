"""Fig 4.2 model architecture, Fig 5.7 ladder and ablations, Fig 5.1 methodology flowchart. Approved style."""

from dg import Diagram, BLUE, INK, SOFT, MONO


def tag(d, x, y, s, anchor="middle"):
    d.text(x, y, s, size=16, family=MONO, color=SOFT, anchor=anchor)


def inp(d, x, y, title, shape):
    d.text(x, y - 11, title, size=21, weight=600, anchor="start")
    d.text(x, y + 14, shape, size=16, family=MONO, color=SOFT, anchor="start")


def architecture():
    d = Diagram(1400, 640)
    inp(d, 20, 100, "Node history", "[B,72,N,F]")
    inp(d, 20, 270, "Grid fields", "[B,24,8,44,43]")
    inp(d, 20, 400, "Graph prior", "A, bearing")
    inp(d, 20, 480, "Past wind", "[B,N,2]")
    inp(d, 20, 580, "CAMS forecast", "S-B only")
    d.divider([(215, 20), (215, 620)])
    bh = 86
    d.box(255, 57, 200, bh, "Causal SWT", "db4, 3 levels")
    d.box(500, 57, 240, bh, "Source-group gate", "7 groups")
    d.box(790, 57, 210, bh, "Transformer", "2 layers, causal")
    d.box(255, 227, 200, bh, "ConvLSTM", "at node points")
    cx = 1095
    d.circle(cx, 100, 18)
    d.text(cx, 100, "||", size=20, weight=700, color=BLUE)
    d.box(960, 357, 270, bh, "Wind-aware graph", "diffusion, K = 2")
    d.box(1262, 357, 128, bh, "Decoder", "48 leads")
    d.line([(195, 100), (255, 100)])
    d.line([(455, 100), (500, 100)])
    d.line([(740, 100), (790, 100)])
    d.line([(1000, 100), (1077, 100)])
    d.line([(195, 270), (255, 270)])
    d.line([(455, 270), (cx, 270), (cx, 118)])
    d.line([(cx + 18, 100), (1160, 100), (1160, 357)])
    d.line([(195, 400), (960, 400)])
    d.line([(195, 480), (1000, 480), (1000, 443)])
    d.line([(195, 580), (1326, 580), (1326, 443)], dash="7 6")
    tag(d, 1040, 130, "[B,N,64]")
    tag(d, 760, 250, "[B,N,16]")
    tag(d, 1170, 300, "[B,N,80]", anchor="start")
    d.line([(620, 57), (620, 25), (1300, 25), (1300, 50)])
    d.text(1312, 40, "gates", size=21, weight=600, anchor="start")
    d.text(1312, 66, "[B,N,7]", size=16, family=MONO, color=SOFT, anchor="start")
    d.line([(1230, 400), (1262, 400)])
    d.line([(1326, 357), (1326, 312)])
    d.text(1326, 268, "pred", size=21, weight=600)
    d.text(1326, 293, "[B,48,N]", size=16, family=MONO, color=SOFT)
    d.save("fig4_2_mwafn_architecture")


def ladder():
    comps = ["Transformer", "Static graph", "Adaptive graph", "Wavelet", "ConvLSTM", "Gating"]
    rungs = [("M0", [0, 0, 0, 0, 0, 0]), ("M1", [0, 1, 0, 0, 0, 0]), ("M2", [0, 1, 1, 0, 0, 0]), ("M3", [1, 1, 1, 0, 0, 0]),
             ("M4", [1, 1, 1, 1, 0, 0]), ("M5", [1, 1, 1, 1, 1, 0]), ("M6", [1, 1, 1, 1, 1, 1])]
    abl = [("no wavelet", [1, 1, 1, 0, 1, 1]), ("no graph", [1, 0, 0, 1, 1, 1]), ("fixed graph", [1, 1, 0, 1, 1, 1]),
           ("no ConvLSTM", [1, 1, 1, 1, 0, 1]), ("GRU encoder", [0, 1, 1, 1, 1, 1]), ("no gating", [1, 1, 1, 1, 1, 0])]
    x0, cw, rh = 230, 193, 46
    d = Diagram(1400, 790)
    for j, c in enumerate(comps):
        d.text(x0 + j * cw + cw / 2, 30, c, size=21, weight=600)

    def row(y, name, flags):
        d.text(40, y, name, size=21, weight=600, anchor="start")
        for j, f in enumerate(flags):
            cx = x0 + j * cw + cw / 2
            d.circle(cx, y, 12, sw=2, fill=BLUE if f else "none")

    d.zone(8, 58, 1384, 7 * rh + 46, "Ladder: add one part per rung", right=True)
    for i, (n, f) in enumerate(rungs):
        row(108 + i * rh, n, f)
    ya = 58 + 7 * rh + 66
    d.zone(8, ya, 1384, 6 * rh + 46, "Ablations of M6: remove one part, 5 seeds", right=True)
    for i, (n, f) in enumerate(abl):
        row(ya + 50 + i * rh, n, f)
    d.save("fig5_7_model_ladder")


def flowchart():
    d = Diagram(1400, 905)

    def step(x, y, s, w=400, h=58):
        d.box(x - w / 2, y, w, h, s, r=8, size=21)
        return y + h

    def term(x, y, s):
        d.rect(x - 110, y, 220, 52, r=26)
        d.text(x, y + 26, s, size=21, weight=600)
        return y + 52

    def diamond(x, y, s, w=300, h=100):
        d.shape(f"M{x},{y} L{x + w / 2},{y + h / 2} L{x},{y + h} L{x - w / 2},{y + h / 2} Z")
        d.text(x, y + h / 2, s, size=21, weight=600)
        return y + h

    def down(x, a, b):
        d.line([(x, a), (x, b)])

    c1, c2, g = 300, 1080, 28
    y = 10
    for f, s in [(term, "Start"), (step, "Download data (sha256)"), (step, "Select 116 stations"), (step, "Quality control"),
                 (step, "Latency-safe features"), (step, "Dataset + SPLITS.lock")]:
        e = f(c1, y, s)
        down(c1, e, e + g)
        y = e + g
    dy = y
    e = diamond(c1, y, "Feature freeze?")
    d.line([(c1 + 150, dy + 50), (560, dy + 50), (560, dy - 59), (c1 + 200, dy - 59)])
    d.label(560, dy - 5, "no", size=19)
    down(c1, e, e + g)
    d.text(c1 + 16, e + 14, "yes", size=19, anchor="start", color=BLUE)
    y = e + g
    names = ["Baselines on validation", "Ladder M0 to M6", "Tune (<= 20 trials)"]
    for s in names:
        e = step(c1, y, s)
        if s != names[-1]:
            down(c1, e, e + g)
        y = e + g
    tune_y = e - 29
    dy2 = 60
    d.line([(c1, e), (c1, e + 22), (720, e + 22), (720, dy2 + 50), (c2 - 150, dy2 + 50)])
    e = diamond(c2, dy2, "Model freeze?")
    d.line([(c2, dy2), (c2, 25), (640, 25), (640, tune_y), (c1 + 200, tune_y)])
    d.label(640, 450, "no", size=19)
    down(c2, e, e + g)
    d.text(c2 + 16, e + 14, "yes", size=19, anchor="start", color=BLUE)
    y = e + g
    for s in ["Final training, 5 seeds", "final_eval.py (once)", "Significance tests", "Attribution checks", "Tables and figures", "Serve model (planned)"]:
        e = step(c2, y, s)
        down(c2, e, e + g)
        y = e + g
    term(c2, y, "End")
    d.save("fig5_1_methodology_flowchart")


if __name__ == "__main__":
    architecture()
    ladder()
    flowchart()
