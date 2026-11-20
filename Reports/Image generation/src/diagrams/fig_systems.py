"""Component figures in the approved style: Fig 4.1 architecture, Fig 1.2 overview, Fig 4.7 deployment,
Fig 5.8 restart-safe training. Canvas 1400 px wide = full A4 text width."""

from dg import Diagram, SOFT, S

SOURCES = [("aq_station", 178, 36, 345, 335, "CPCB stations", "hourly PM2.5"),
           ("satellite", 527, 60, 345, 300, "NASA FIRMS", "fire detections"),
           ("server_rack", 875, 30, 260, 340, "Copernicus", "ERA5, CAMS"),
           ("ground_antenna", 1222, 34, 340, 336, "Open-Meteo", "weather")]


def sources_row(d, title="Data sources"):
    d.zone(8, 8, 1384, 464, title)
    for ic, cx, y, w, h, t, sub in SOURCES:
        d.icon(ic, cx - w / 2, y, w, h)
        d.node(cx, 412, t, sub, size=27, sub_size=21)


def architecture():
    d = Diagram(1400, 1150)
    sources_row(d)
    d.add('<g transform="translate(0,118)">')
    d.zone(8, 372, 512, 650, "Research pipeline", right=True)
    for x, t in [(78, "Ingest"), (250, "QC + features"), (440, "Datasets")]:
        d.node(x, 440, t)
    d.line([(126, 440), (152, 440)])
    d.line([(350, 440), (380, 440)])
    d.line([(440, 460), (440, 510)])
    d.item("gpu_workstation", 250, 455, 400, 350, "Train + validate", "M0 to M6, baselines")
    d.line([(250, 878), (250, 916)])
    d.node(250, 965, "Final evaluation", "frozen test, once")
    d.zone(538, 372, 482, 650, "Live platform", right=True)
    for x, t in [(605, "Fetch"), (745, "Fuse"), (915, "REST API")]:
        d.node(x, 440, t)
    d.line([(645, 440), (700, 440)])
    d.line([(790, 440), (845, 440)])
    d.item("server_rack", 780, 470, 210, 410, "API server", "FastAPI, AI insights")
    d.zone(1038, 372, 354, 650, "Users", right=True)
    d.item("user_display", 1215, 520, 340, 285, "Web dashboard", "desktop, phone")
    d.line([(78, 352), (78, 415)])
    d.line([(605, 352), (605, 415)])
    d.line([(915, 463), (915, 640), (1060, 640)], head="both")
    d.line([(450, 700), (675, 700)], dash="7 6")
    d.label(565, 700, "model (planned)")
    d.add("</g>")
    d.save("fig4_1_system_architecture")


def overview():
    d = Diagram(1400, 1040)
    sources_row(d, "Public data")
    d.zone(8, 500, 920, 532, "AeroFusion", right=True)
    d.item("server_rack", 230, 540, 220, 390, "Live platform", "33 cities, every 12 h")
    d.item("gpu_workstation", 640, 560, 430, 370, "MW-AeroFusion-Net", "48 h forecasts")
    d.zone(946, 500, 446, 532, "Users", right=True)
    d.item("user_display", 1169, 600, 410, 330, "Dashboard and forecasts")
    d.line([(230, 472), (230, 530)])
    d.line([(640, 472), (640, 548)])
    d.line([(425, 760), (345, 760)], dash="7 6")
    d.label(385, 720, "after freeze")
    d.line([(928, 760), (968, 760)])
    d.save("fig1_2_system_overview")


def deployment():
    d = Diagram(1400, 1030)
    d.item("gpu_workstation", 230, 20, 380, 330, "Training machine", "RTX PRO 4500, 32 GB")
    d.zone(500, 8, 892, 452, "Public data services", right=True)
    d.item("aq_station", 650, 50, 300, 280, "XKDR (CPCB)")
    d.item("satellite", 960, 70, 330, 260, "NASA FIRMS")
    d.item("server_rack", 1250, 45, 160, 285, "Copernicus, ARCO")
    d.node(230, 520, "GitHub (main)", "code, configs, metrics")
    d.item("ground_antenna", 160, 640, 250, 240, "Open-Meteo", "live weather")
    d.item("server_rack", 470, 600, 175, 290, "Render", "FastAPI API")
    d.item("server_rack", 760, 620, 150, 270, "Vercel", "static site")
    d.item("user_display", 1050, 620, 330, 270, "Browser", "desktop, phone")
    d.item("server_rack", 1310, 640, 130, 250, "LLM", "Bedrock, Groq")
    d.line([(500, 190), (425, 190)])
    d.label(462, 160, "HTTPS")
    d.line([(230, 440), (230, 488)], head="both")
    d.line([(760, 460), (760, 560), (530, 560), (530, 598)])
    d.line([(330, 520), (405, 520), (405, 598)])
    d.label(405, 560, "deploy")
    d.line([(425, 330), (468, 330), (468, 598)], dash="7 6")
    d.label(468, 420, "ONNX (planned)")
    d.line([(290, 760), (375, 760)])
    d.line([(560, 760), (680, 760)], head="both")
    d.label(620, 730, "/api")
    d.line([(840, 760), (880, 760)], head="both")
    d.line([(1310, 945), (1310, 990), (470, 990), (470, 950)], head="both")
    d.label(890, 990, "prompt / text")
    d.save("fig4_7_deployment")


def restart_safe():
    d = Diagram(1400, 700)
    d.item("gpu_workstation", 190, 120, 340, 300, "Training machine")
    d.zone(380, 8, 1012, 300, "Normal run", right=True)
    xs = [520, 780, 1035, 1270]
    for x, (t, s) in zip(xs, [("lane.ps1", "runs the queue"), ("run_ladder.py", "skips done runs"),
                              ("train.py", "last.pt each epoch"), ("metrics.json", "run complete")]):
        d.node(x, 120, t, s)
    for a, b in [(600, 675), (885, 930), (1135, 1180)]:
        d.line([(a, 120), (b, 120)])
    d.line([(1000, 160), (1000, 220), (1070, 220), (1070, 160)])
    d.label(1035, 250, "next epoch")
    d.zone(380, 330, 1012, 362, "After a power cut")
    for x, (t, s) in zip(xs, [("Power cut", "processes lost"), ("Auto power-on", "BIOS: last state"),
                              ("Watchdog", "boot + 3 min, hourly"), ("Relaunch lane", "same commands")]):
        d.node(x, 440, t, s)
    for a, b in [(605, 665), (900, 920), (1150, 1170)]:
        d.line([(a, 440), (b, 440)])
    d.line([(1270, 405), (1270, 300), (520, 300), (520, 165)])
    d.label(895, 300, "resume from last.pt, same run id")
    d.node(1035, 600, "E-mail to the team", "status, last epoch")
    d.line([(1035, 480), (1035, 560)])
    d.save("fig5_8_restart_safe_training")


if __name__ == "__main__":
    architecture()
    overview()
    deployment()
    restart_safe()
