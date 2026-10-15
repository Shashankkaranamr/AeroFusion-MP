"""Download raw sources into ml/data/raw/ (resumable, idempotent, sha256 in MANIFEST.json). PROGRESS P1.

    python ml/scripts/download_all.py --source xkdr
    python ml/scripts/download_all.py --source cams_fc            # P1.7, ADS; queues can take days: run in background
    python ml/scripts/download_all.py --source era5_grid          # P1.6, CDS
    python ml/scripts/download_all.py --source firms              # P1.8, yearly country CSVs (no key)
    python ml/scripts/download_all.py --source openmeteo          # P1.5, node met for stations_v1 + regions (writes nodes_v1.csv)
    (Copernicus sources take --start/--end YYYY-MM; default 2017-12 -> 2025-09, i.e. a 72 h warm-up before train + the PM-only check)
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from aerofusion_ml.data import copernicus, firms, openmeteo, xkdr  # noqa: E402
from aerofusion_ml.env import need  # noqa: E402


def run_xkdr() -> None:
    key = need("XKDR_API_KEY")
    with httpx.Client(timeout=httpx.Timeout(60, read=300), follow_redirects=True) as c:
        listing = xkdr.list_files(c, key)
        files = listing["files"]
        print(f"XKDR export {listing['exported_at']}: {len(files)} files, {sum(f['bytes'] for f in files) / 1e6:.0f} MB", flush=True)
        new = 0
        for i, f in enumerate(files, 1):
            for attempt in range(3):
                try:
                    _, fetched = xkdr.download(c, key, f)
                    break
                except (httpx.HTTPError, OSError) as e:
                    print(f"  retry {attempt + 1}/3 {f['key']}: {type(e).__name__}", flush=True)
            else:
                raise SystemExit(f"failed: {f['key']}")
            new += fetched
            if fetched and (new % 20 == 0 or i == len(files)):
                print(f"  {i}/{len(files)} done ({new} downloaded this run)", flush=True)
        print(f"XKDR complete: {new} downloaded, {len(files) - new} already present", flush=True)


def run_openmeteo() -> None:
    data = Path(__file__).resolve().parents[1] / "data"
    n = openmeteo.nodes(data / "stations_v1.csv")
    n.to_csv(data / "nodes_v1.csv", index=False)
    cells, chunks = sorted(n["cell"].unique()), openmeteo.year_chunks()
    print(f"Open-Meteo ERA5: {len(n)} nodes -> {len(cells)} cells x {len(chunks)} years", flush=True)
    new = 0
    with httpx.Client(timeout=120) as c:
        for i, cell in enumerate(cells, 1):
            for year, start, end in chunks:
                new += openmeteo.fetch(c, cell, year, start, end, log=lambda m: print(m, flush=True))[1]
            print(f"  {i}/{len(cells)} cells done ({new} files fetched this run)", flush=True)
    print("Open-Meteo complete", flush=True)


def run_firms() -> None:
    jobs = [(s, y, c) for s in firms.SENSORS for y in firms.YEARS for c in firms.COUNTRIES]
    print(f"FIRMS: {len(jobs)} yearly country files", flush=True)
    with httpx.Client(timeout=httpx.Timeout(60, read=600), follow_redirects=True) as c:
        for s, y, ctry in jobs:
            for attempt in range(3):
                try:
                    dest, new = firms.download(c, s, y, ctry)
                    break
                except httpx.HTTPStatusError as e:
                    if e.response.status_code == 404:
                        print(f"  {s} {y} {ctry}: not published (404)", flush=True)
                        dest, new = None, False
                        break
                    print(f"  retry {s} {y} {ctry}: HTTP {e.response.status_code}", flush=True)
                except httpx.HTTPError as e:
                    print(f"  retry {s} {y} {ctry}: {type(e).__name__}", flush=True)
            else:
                raise SystemExit(f"failed: {s} {y} {ctry}")
            if new:
                print(f"  {s} {y} {ctry}: {dest.stat().st_size / 1e6:.1f} MB", flush=True)
    print("FIRMS complete", flush=True)


def run_copernicus(source: str, start: str, end: str, max_active: int) -> None:
    copernicus.run(source, copernicus.months(start, end), max_active=max_active, log=lambda msg: print(msg, flush=True))


SOURCES = {"xkdr": run_xkdr, "openmeteo": run_openmeteo, "firms": run_firms, **{s: s for s in copernicus.SOURCES}}

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", choices=sorted(SOURCES), required=True)
    ap.add_argument("--start", default="2017-12")
    ap.add_argument("--end", default="2025-09")
    ap.add_argument("--max-active", type=int, default=4, help="jobs kept queued on the portal (lowered automatically on queue-limit rejections)")
    a = ap.parse_args()
    if a.source in copernicus.SOURCES:
        run_copernicus(a.source, a.start, a.end, a.max_active)
    else:
        SOURCES[a.source]()
