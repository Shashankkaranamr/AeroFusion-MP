"""DFD level 0 / 1, data design, repository structure, splits and latency timelines, Gantt, algorithms.
Approved style: blue only for lines and shapes, black / grey text, colour components, 1400 px wide."""

from datetime import date
from math import hypot

from dg import Diagram, BLUE, INK, SOFT, MONO


def proc(d, x, y, r, pid, title, size=21):
    d.circle(x, y, r, sw=2.2)
    d.text(x, y - r * 0.5, pid, size=17, weight=700, color=BLUE)
    d.lines(x, y + 8, title.split("\n"), size=size, weight=600, gap=size * 1.2)


def edge(p, c, r):
    dx, dy = p[0] - c[0], p[1] - c[1]
    n = hypot(dx, dy)
    return (c[0] + dx / n * r, c[1] + dy / n * r)


def store(d, x, y, w, sid, s):
    h = 40
    d.shape(f"M{x + w},{y - h / 2} H{x} V{y + h / 2} H{x + w}", sw=2)
    d.add(f'<line x1="{x + 50}" y1="{y - h / 2}" x2="{x + 50}" y2="{y + h / 2}" stroke="{BLUE}" stroke-width="2"/>')
    d.text(x + 25, y, sid, size=19, weight=700, color=BLUE)
    d.text(x + 62, y, s, size=19, anchor="start")


# ------------------------------------------------------------------ DFD

def dfd0():
    d = Diagram(1400, 900)
    C, R = (700, 450), 165
    d.circle(C[0], C[1], R, sw=2.4)
    d.text(C[0], C[1] - 70, "0", size=20, weight=700, color=BLUE)
    d.lines(C[0], C[1] + 6, ["AeroFusion", "system"], size=30, weight=700, gap=36)
    left = [("aq_station", 20, "CPCB stations", "pollutants"), ("satellite", 240, "NASA FIRMS", "fire detections"),
            ("server_rack", 460, "Copernicus", "ERA5, CAMS"), ("ground_antenna", 680, "Open-Meteo", "weather")]
    for ic, y, t, flow in left:
        d.item(ic, 150, y, 260, 150, t, gap=24, size=22)
        p = (285, y + 75)
        e = edge(p, C, R + 6)
        d.line([p, e])
        d.label((p[0] + e[0]) / 2, (p[1] + e[1]) / 2 - 18, flow)
    right = [("user_display", 20, 280, 200, "Users", "views", "requests"),
             ("gpu_workstation", 320, 230, 200, "Project team", "metrics", "configs"),
             ("server_rack", 620, 120, 200, "LLM providers", "prompt", "text")]
    for ic, y, w, h, t, out, inn in right:
        d.item(ic, 1255, y, w, h, t, gap=24, size=22)
        p = (1255 - w / 2 - 15, y + h / 2)
        a, b = (p[0], p[1] - 16), (p[0], p[1] + 16)
        ea, eb = edge(a, C, R + 6), edge(b, C, R + 6)
        d.line([ea, a])
        d.line([b, eb])
        d.label((a[0] + ea[0]) / 2, (a[1] + ea[1]) / 2 - 18, out)
        d.label((b[0] + eb[0]) / 2, (b[1] + eb[1]) / 2 + 18, inn)
    d.save("fig4_8a_dfd_level0")


def dfd1():
    d = Diagram(1400, 1040)
    r = 72
    P1, P2, P3, P4, P5, P6 = (330, 150), (330, 410), (330, 670), (720, 900), (1080, 150), (1080, 470)
    proc(d, *P1, r, "1", "Acquire\ndata")
    proc(d, *P2, r, "2", "QC +\nfeatures")
    proc(d, *P3, r, "3", "Train +\nvalidate")
    proc(d, *P4, r, "4", "Final\nevaluation")
    proc(d, *P5, r, "5", "Live\nrefresh")
    proc(d, *P6, r, "6", "API +\nAI")
    store(d, 450, 150, 270, "D1", "raw files")
    store(d, 450, 410, 270, "D2", "datasets, SPLITS")
    store(d, 450, 670, 270, "D3", "run folders")
    store(d, 945, 310, 270, "D4", "snapshots")
    d.item("aq_station", 85, 8, 150, 100, "CPCB", gap=18, size=20)
    d.item("server_rack", 85, 170, 70, 100, "Copernicus", gap=18, size=20)
    d.item("satellite", 85, 330, 160, 85, "FIRMS", gap=18, size=20)
    d.item("gpu_workstation", 90, 720, 150, 130, "Team", gap=18, size=20)
    d.item("ground_antenna", 1300, 15, 130, 105, "Open-Meteo", gap=18, size=20)
    d.item("user_display", 1300, 395, 190, 150, "Users", gap=18, size=20)
    d.item("server_rack", 1310, 690, 70, 110, "LLM", gap=18, size=20)
    for p in [(165, 60), (125, 220), (170, 372)]:
        d.line([p, edge(p, P1, r + 6)])
    d.line([(402, 150), (446, 150)])
    d.line([(585, 170), (585, 280), (330, 280), (330, 334)])
    d.label(460, 280, "raw data")
    d.line([(402, 410), (446, 410)])
    d.line([(585, 430), (585, 540), (330, 540), (330, 594)])
    d.label(460, 540, "train + val only")
    d.line([(402, 670), (446, 670)])
    d.line([(690, 690), (690, 832)])
    d.label(690, 765, "checkpoints")
    d.line([(720, 410), (800, 410), (800, 900), (796, 900)])
    d.label(800, 620, "test, once")
    d.line([(165, 760), (330, 760), (330, 746)])
    d.label(250, 760, "configs")
    d.line([(165, 830), (560, 830), (560, 900), (644, 900)])
    d.label(400, 830, "freeze")
    d.line([(720, 976), (720, 1018), (90, 1018), (90, 900)])
    d.label(400, 1018, "tables, figures")
    d.line([(1235, 70), edge((1235, 70), P5, r + 6)])
    d.line([(1080, 226), (1080, 288)])
    d.line([(1080, 332), (1080, 394)])
    d.line([(1156, 470), (1200, 470)], head="both")
    d.line([(1120, 540), (1120, 745), (1270, 745)], head="both")
    d.label(1195, 745, "prompt / text", size=16)
    d.line([(720, 670), (960, 670), (960, 520), (1012, 505)], dash="7 6")
    d.label(960, 600, "model (planned)")
    d.save("fig4_8b_dfd_level1")


# ------------------------------------------------------------------ data design

def table(d, x, y, w, title, rows):
    rh = 31
    d.text(x, y, title, size=22, weight=700, anchor="start", family=MONO)
    d.add(f'<line x1="{x}" y1="{y + 20}" x2="{x + w}" y2="{y + 20}" stroke="{BLUE}" stroke-width="2.2"/>')
    for i, (k, t) in enumerate(rows):
        yy = y + 20 + rh * (i + 0.5) + 4
        d.text(x, yy, k, size=18.5, anchor="start", family=MONO)
        d.text(x + w, yy, t, size=18.5, anchor="end", family=MONO, color=SOFT)
    yb = y + 20 + rh * len(rows) + 10
    d.add(f'<line x1="{x}" y1="{yb}" x2="{x + w}" y2="{yb}" stroke="{BLUE}" stroke-width="1.2"/>')
    return yb


def data_design():
    d = Diagram(1400, 640)
    table(d, 20, 30, 420, "dataset_v1.zarr", [("time", "hourly UTC"), ("node", "116 + regions"), ("x_node", "[t, node, feat]"),
                                               ("m_node", "observed mask"), ("y", "PM2.5")])
    table(d, 20, 290, 420, "grid_v1.zarr", [("time", "3-hourly"), ("channel", "8"), ("lat x lon", "44 x 43")])
    table(d, 20, 470, 420, "cams_fc_v1.zarr", [("run", "00 / 12 UTC"), ("lead", "0..48 h"), ("var", "PM2.5, AOD")])
    table(d, 500, 30, 400, "SPLITS.lock", [("train", "2018-2021"), ("val", "2022"), ("test", "2023-2024"), ("test_pm", "2025")])
    table(d, 500, 290, 400, "runs/<run_id>/", [("config.yaml", "settings"), ("metrics.json", "measured"), ("ckpt.pt", "best epoch"), ("preds_val", "parquet")])
    table(d, 960, 30, 420, "batch -> model", [("x_node", "[B,72,N,F]"), ("x_grid", "[B,24,8,44,43]"), ("y, y_mask", "[B,48,N]"),
                                              ("pred", "[B,48,N]"), ("gates", "[B,N,7]")])
    table(d, 960, 290, 420, "live snapshot", [("tensor", "[72, 33, 20]"), ("sources", "status")])
    d.line([(440, 110), (496, 110)], kind="open", dash="7 5")
    d.line([(900, 110), (956, 110)], kind="open", dash="7 5")
    d.line([(440, 160), (470, 160), (470, 380), (496, 380)], kind="open", dash="7 5")
    d.label(470, 270, "trains", size=16)
    d.save("fig4_9_data_design")


# ------------------------------------------------------------------ repository tree

def repo_tree():
    rows = [("AeroFusion-MP/", "", 0), ("backend/", "live API (FastAPI)", 1), ("app/live/", "sources, service, ai", 2),
            ("frontend/", "story site + dashboard", 1), ("src/app/views/", "dashboard views", 2), ("src/scenes/", "Three.js story", 2),
            ("ml/", "model package", 1), ("aerofusion_ml/data/", "download, QC, windows", 2), ("aerofusion_ml/models/", "model, baselines", 2),
            ("scripts/", "build, train, evaluate", 2), ("configs/exp/", "one YAML per run", 2), ("tests/", "pytest", 2),
            ("data/", "raw, processed, SPLITS", 2), ("runs/", "one folder per run", 2),
            ("docs/", "paper, report", 1), ("Reports/", "report figures", 1), ("PROGRESS.md", "plan and decisions", 1)]
    lh = 38
    d = Diagram(1400, 30 + len(rows) * lh)
    x0, y0 = 30, 25
    for i, (name, note, lvl) in enumerate(rows):
        y = y0 + i * lh
        x = x0 + lvl * 44
        if lvl > 0:
            px = x0 + (lvl - 1) * 44 + 10
            d.line([(px, y - lh + 14), (px, y), (x - 8, y)], head=None, sw=1.6, r=0)
        d.text(x, y, name, size=21 if lvl < 2 else 20, weight=700 if lvl < 2 else 500, anchor="start", family=MONO)
        if note:
            d.text(720, y, note, size=20, anchor="start", color=SOFT)
    d.save("fig4_10_repository_structure")


# ------------------------------------------------------------------ timelines

def patterns(d):
    d.defs["p_hatch"] = ('<pattern id="p_hatch" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">'
                         f'<line x1="0" y1="0" x2="0" y2="9" stroke="{BLUE}" stroke-width="1.6"/></pattern>')
    d.defs["p_dots"] = ('<pattern id="p_dots" width="9" height="9" patternUnits="userSpaceOnUse">'
                        f'<circle cx="4.5" cy="4.5" r="1.6" fill="{BLUE}"/></pattern>')
    d.defs["p_cross"] = ('<pattern id="p_cross" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">'
                         f'<line x1="0" y1="0" x2="0" y2="10" stroke="{BLUE}" stroke-width="1.3"/><line x1="0" y1="0" x2="10" y2="0" stroke="{BLUE}" stroke-width="1.3"/></pattern>')


def bar(d, x, y, w, h, fill=None, dash=None, solid=False):
    f = BLUE if solid else (f"url(#{fill})" if fill else "none")
    ds = f' stroke-dasharray="{dash}"' if dash else ""
    d.add(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{f}" stroke="{BLUE}" stroke-width="2"{ds}/>')


def splits_timeline():
    d = Diagram(1400, 380)
    patterns(d)
    x0, x1 = 30, 1370
    t0, t1 = date(2018, 1, 1), date(2027, 3, 1)
    X = lambda dt: x0 + (dt - t0).days / (t1 - t0).days * (x1 - x0)
    y = 70
    for a, b, lab, f, ds in [(date(2018, 1, 1), date(2022, 1, 1), "Train", "p_hatch", None), (date(2022, 1, 1), date(2023, 1, 1), "Val", "p_dots", None),
                             (date(2023, 1, 1), date(2025, 1, 1), "Test (frozen)", "p_cross", None), (date(2025, 4, 1), date(2025, 10, 1), "PM-only", "p_hatch", None),
                             (date(2026, 10, 15), date(2027, 3, 1), "Prospective", None, "8 5")]:
        bar(d, X(a), y, X(b) - X(a), 56, fill=f, dash=ds)
        d.text((X(a) + X(b)) / 2, y - 26, lab, size=21, weight=600)
    yb = y + 72
    d.line([(x0, yb), (x1, yb)], head=None, sw=2)
    for yr in range(2018, 2028):
        xx = X(date(yr, 1, 1))
        d.line([(xx, yb), (xx, yb + 10)], head=None, sw=2)
        if yr < 2027:
            d.text((xx + X(date(yr + 1, 1, 1))) / 2, yb + 30, str(yr), size=19, color=SOFT)
    y2 = 290
    d.text(x0, y2 - 34, "ROLLING-ORIGIN FOLD", size=16.5, weight=700, anchor="start", color=BLUE)
    for a, b, f in [(date(2018, 1, 1), date(2022, 7, 1), "p_hatch"), (date(2022, 7, 1), date(2023, 7, 1), "p_dots"), (date(2023, 7, 1), date(2025, 1, 1), "p_cross")]:
        bar(d, X(a), y2, X(b) - X(a), 34, fill=f)
    d.save("fig5_2_data_splits")


def latency_timeline():
    d = Diagram(1400, 560)
    patterns(d)
    x0, x1 = 300, 1380
    h0, h1 = -78, 50
    X = lambda h: x0 + (h - h0) / (h1 - h0) * (x1 - x0)
    rows = [("Station data", -72, -1), ("Weather", -72, -1), ("Fire detections", -72, -3), ("Grid fields", -72, -1),
            ("CAMS (S-B)", -72, 0), ("Targets (loss)", 1, 48)]
    top, rh = 55, 60
    for i, (name, a, b) in enumerate(rows):
        y = top + i * rh
        d.text(x0 - 20, y + 17, name, size=21, weight=600, anchor="end")
        if name.startswith("Targets"):
            bar(d, X(a), y, X(b) - X(a), 34, fill="p_dots")
            continue
        bar(d, X(a), y, X(b) - X(a), 34, fill="p_hatch")
        if b < 0:
            bar(d, X(b), y, X(0) - X(b), 34, dash="4 4")
        if name.startswith("CAMS"):
            bar(d, X(0), y, X(48) - X(0), 34, dash="8 5")
            d.text(X(24), y + 17, "latest run, leads 1-48", size=18, color=SOFT)
    yb = top + len(rows) * rh + 4
    d.line([(x0, yb), (x1, yb)], head=None, sw=2)
    for h in range(-72, 49, 24):
        d.line([(X(h), yb), (X(h), yb + 8)], head=None, sw=2)
        d.text(X(h), yb + 28, "t0" if h == 0 else f"{h:+d} h", size=19, weight=700 if h == 0 else 400, color=INK if h == 0 else SOFT)
    d.line([(X(0), 30), (X(0), yb)], head=None, sw=2.2, dash="8 6")
    d.text(X(0), 18, "issue time", size=19, weight=600, color=BLUE)
    ly = yb + 70
    bar(d, x0, ly - 10, 34, 20, fill="p_hatch")
    d.text(x0 + 44, ly, "input", size=19, anchor="start", color=SOFT)
    bar(d, x0 + 170, ly - 10, 34, 20, dash="4 4")
    d.text(x0 + 214, ly, "not yet published", size=19, anchor="start", color=SOFT)
    bar(d, x0 + 470, ly - 10, 34, 20, fill="p_dots")
    d.text(x0 + 514, ly, "forecast horizon", size=19, anchor="start", color=SOFT)
    d.save("fig5_3_latency_timeline")


def gantt():
    d = Diagram(1400, 620)
    x0, x1 = 300, 1380
    t0, t1 = date(2026, 10, 19), date(2027, 2, 22)
    X = lambda dt: x0 + (dt - t0).days / (t1 - t0).days * (x1 - x0)
    top, rh = 70, 54
    rows = [("Setup", date(2026, 10, 19), date(2026, 10, 26), date(2026, 10, 19), date(2026, 11, 3)),
            ("Data and QC", date(2026, 10, 19), date(2026, 11, 23), date(2026, 10, 19), date(2026, 11, 12)),
            ("Baselines", date(2026, 11, 16), date(2026, 12, 7), date(2026, 11, 12), date(2026, 11, 15)),
            ("Model ladder", date(2026, 11, 30), date(2027, 1, 11), date(2026, 11, 14), date(2026, 11, 19)),
            ("Final runs, test", date(2027, 1, 4), date(2027, 1, 25), date(2026, 11, 20), date(2026, 11, 21)),
            ("Platform", date(2027, 1, 11), date(2027, 2, 1), None, None),
            ("Paper, report", date(2027, 1, 18), date(2027, 2, 22), None, None)]
    months = [(date(2026, 10, 19), "Oct"), (date(2026, 11, 1), "Nov"), (date(2026, 12, 1), "Dec"), (date(2027, 1, 1), "Jan"), (date(2027, 2, 1), "Feb")]
    yb = top + len(rows) * rh
    for i, (m, n) in enumerate(months):
        nx = X(months[i + 1][0]) if i + 1 < len(months) else x1
        d.divider([(X(m), top - 12), (X(m), yb)])
        d.text((X(m) + nx) / 2, top - 34, n, size=20, weight=600, color=BLUE)
    for i, (name, pa, pb, aa, ab) in enumerate(rows):
        y = top + i * rh + rh / 2
        d.text(x0 - 20, y, name, size=21, weight=600, anchor="end")
        bar(d, X(pa), y - 16, X(pb) - X(pa), 32, dash="6 4")
        if aa:
            bar(d, X(aa), y - 8, max(X(ab) - X(aa), 6), 16, solid=True)
    for dt, lab, dy in [(date(2026, 11, 12), "feature freeze", 56), (date(2026, 11, 21), "deadline 21 Nov", 28), (date(2026, 11, 25), "ICICC paper due", 0)]:
        d.line([(X(dt), top - 10), (X(dt), yb + 16 + dy)], head=None, sw=1.6, dash="3 4")
        d.shape(f"M{X(dt)},{yb + 8 + dy} l8,8 l-8,8 l-8,-8 Z", fill=BLUE, sw=1)
        d.text(X(dt) + 14, yb + 16 + dy, lab, size=18, anchor="start")
    ly = yb + 100
    bar(d, x0, ly - 10, 40, 20, dash="6 4")
    d.text(x0 + 50, ly, "planned", size=19, anchor="start", color=SOFT)
    bar(d, x0 + 180, ly - 6, 40, 12, solid=True)
    d.text(x0 + 230, ly, "actual", size=19, anchor="start", color=SOFT)
    d.save("fig1_3_work_plan_gantt")


# ------------------------------------------------------------------ algorithms

def algorithm(name, title, lines):
    lh = 34
    h = 100 + len(lines) * lh
    d = Diagram(1400, h)
    d.add(f'<line x1="10" y1="12" x2="1390" y2="12" stroke="{BLUE}" stroke-width="2.4"/>')
    d.text(10, 40, title, size=23, weight=700, anchor="start")
    d.add(f'<line x1="10" y1="66" x2="1390" y2="66" stroke="{BLUE}" stroke-width="1.4"/>')
    y = 94
    for i, (ind, s) in enumerate(lines):
        d.text(44, y, str(i + 1), size=17, anchor="end", color=BLUE, family=MONO)
        kw = s.split(" ")[0]
        bold = kw in ("for", "if", "else", "return", "end", "Input:", "Output:", "load", "save")
        d.text(62 + ind * 36, y, s, size=20, anchor="start", family=MONO, weight=700 if bold else 400)
        y += lh
    d.add(f'<line x1="10" y1="{y - 10}" x2="1390" y2="{y - 10}" stroke="{BLUE}" stroke-width="2.4"/>')
    d.save(name)


def algorithms():
    algorithm("alg1_qc_and_windows", "Algorithm 1: Quality control and latency-safe inputs", [
        (0, "Input: hourly series x, issue time t0"),
        (0, "Output: inputs X, masks M, targets y"),
        (0, "for each station and pollutant do"),
        (1, "drop sentinels and out-of-range values"),
        (1, "drop runs of >= 6 identical hours"),
        (1, "if |x - median24h| > 6 MAD and not a city-wide spike then"),
        (2, "x <- missing"),
        (0, "for each source k do"),
        (1, "keep values with time <= t0 - latency_k"),
        (1, "fill gaps <= 3 h forward; mask the rest"),
        (0, "normalise X with train-year statistics"),
        (0, "y <- PM2.5 at t0+1 .. t0+48 (never filled)"),
        (0, "return X, M, y"),
    ])
    algorithm("alg2_restart_safe_training", "Algorithm 2: Restart-safe training with early stopping", [
        (0, "Input: config, seed; patience 8, max 60 epochs"),
        (0, "if run already measured then return"),
        (0, "if last.pt exists then resume from it"),
        (0, "for each epoch do"),
        (1, "for each batch of 32 training windows do"),
        (2, "loss <- masked Huber + entropy penalty"),
        (2, "AdamW step, cosine schedule"),
        (1, "r <- validation RMSE (2022)"),
        (1, "if r improves then save ckpt.pt"),
        (1, "save last.pt"),
        (1, "if no improvement for 8 epochs then stop"),
        (0, "load ckpt.pt; write metrics.json; delete last.pt"),
    ])


if __name__ == "__main__":
    dfd0()
    dfd1()
    data_design()
    repo_tree()
    splits_timeline()
    latency_timeline()
    gantt()
    algorithms()
