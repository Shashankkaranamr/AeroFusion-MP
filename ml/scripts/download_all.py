"""Download raw sources into ml/data/raw/ (resumable, idempotent, sha256 in MANIFEST.json). PROGRESS P1.

    python ml/scripts/download_all.py --source xkdr
    python ml/scripts/download_all.py --source cams_fc            # P1.7, ADS; queues can take days: run in background
    python ml/scripts/download_all.py --source era5_grid          # P1.6, CDS
    (Copernicus sources take --start/--end YYYY-MM; default 2017-12 -> 2025-09, i.e. a 72 h warm-up before train + the PM-only check)
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from aerofusion_ml.data import copernicus, xkdr  # noqa: E402
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


def run_copernicus(source: str, start: str, end: str, max_active: int) -> None:
    copernicus.run(source, copernicus.months(start, end), max_active=max_active, log=lambda msg: print(msg, flush=True))


SOURCES = {"xkdr": run_xkdr, **{s: s for s in copernicus.SOURCES}}

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
