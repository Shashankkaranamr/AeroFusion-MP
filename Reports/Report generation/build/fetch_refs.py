"""Fetch Crossref metadata for recent references and write IEEE-style lines to content/refs_recent.txt (verified by DOI)."""
import json, re, sys, urllib.request, html
DOIS = {
 "Mangaraj_2025": "10.1038/s41612-025-00901-8", "Jayakumar_2025": "10.1175/bams-d-24-0194.1", "Karnati_2025": "10.1007/s00521-025-11047-2",
 "WuST_2025": "10.1007/s11869-025-01818-0", "Ravindiran_2025": "10.1016/j.isci.2025.111894", "HuangFed_2025": "10.1109/jiot.2025.3563956",
 "Shetty_2025": "10.1016/j.envres.2024.120363", "Abbasi_2025": "10.1007/s13762-025-06599-8", "Ambulkar_2025": "10.1029/2024jd042198",
 "Zeng_2025": "10.1016/j.apr.2025.102488", "Neerukonda_2026": "10.1016/j.icee.2026.100011", "Bahadur_2026": "10.1016/j.jastp.2026.106723",
 "GK_2026": "10.3389/fenvs.2026.1960286", "Velraj_2026": "10.1080/10962247.2026.2692680", "Gupta_2026": "10.1002/gdj3.70070",
 "FedDelhi_2026": "10.1016/j.rineng.2026.111937", "Cheng_2026": "10.1038/s41598-026-56223-z", "Ranjan_2026": "10.1016/j.asr.2026.07.106",
}
MON = ["", "Jan.", "Feb.", "Mar.", "Apr.", "May", "Jun.", "Jul.", "Aug.", "Sep.", "Oct.", "Nov.", "Dec."]
def get(doi):
    req = urllib.request.Request("https://api.crossref.org/works/" + doi, headers={"User-Agent": "report-ref-check/1.0"})
    return json.load(urllib.request.urlopen(req, timeout=60))["message"]
def clean(s): return " ".join(html.unescape(re.sub(r"<[^>]+>", "", s or "")).split())
lines, notes = [], []
for key, doi in DOIS.items():
    m = get(doi)
    au = m.get("author", [])
    names = []
    for a in au:
        g = a.get("given", ""); f = a.get("family", a.get("name", ""))
        ini = " ".join(p[0] + "." for p in re.split(r"[\s\-]+", g) if p)
        names.append((ini + " " + f).strip())
    if len(names) > 6: who = names[0] + " et al."
    elif len(names) > 1: who = ", ".join(names[:-1]) + ", and " + names[-1]
    else: who = names[0] if names else ""
    title = clean(m["title"][0]).replace("\u2010", "-").replace("\u2013", "-").replace("\u2014", "-")
    jr = clean((m.get("container-title") or [""])[0]).replace("&amp;", "&")
    dp = (m.get("published") or m.get("issued"))["date-parts"][0]
    date = (MON[dp[1]] + " " if len(dp) > 1 else "") + str(dp[0])
    parts = [f'{who}, "{title}," {jr}']
    if m.get("volume"): parts.append(f"vol. {m['volume']}")
    if m.get("issue"): parts.append(f"no. {m['issue']}")
    if m.get("page"): parts.append(f"p. {m['page'].replace(chr(8211), '-')}")
    elif m.get("article-number"): parts.append(f"Art. no. {m['article-number']}")
    parts.append(date)
    lines.append(f"{key} | " + ", ".join(parts) + f". [Online]. Available: https://doi.org/{doi}")
    notes.append(f"## {key} ({dp[0]}) {title}\n{clean(m.get('abstract',''))[:900]}\n")
open("content/refs_recent.txt", "w", encoding="utf-8").write("# Recent references (2025-2026), fetched from Crossref by DOI\n" + "\n".join(lines) + "\n")
open(sys.argv[1], "w", encoding="utf-8").write("\n".join(notes))
print("\n".join(lines))
