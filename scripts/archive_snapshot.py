"""Save the live platform snapshot to durable storage (PROGRESS P0.2, prospective test archive).

Fetches <API>/api/live/snapshot and writes <out>/snapshot_<updated_at>.json.gz. Idempotent: a snapshot
already saved (same updated_at) is skipped. Stdlib only, so it runs in a bare GitHub Actions runner.

    python scripts/archive_snapshot.py --out data-archive/snapshots
    AEROFUSION_API=http://localhost:8000 python scripts/archive_snapshot.py
"""

from __future__ import annotations

import argparse
import gzip
import json
import os
import sys
import time
import urllib.request
from pathlib import Path


def fetch(api: str, attempts: int = 4) -> bytes:
    url = api.rstrip("/") + "/api/live/snapshot"
    req = urllib.request.Request(url, headers={"User-Agent": "AeroFusion-archiver/0.1"})
    for i in range(attempts):
        try:
            # Render's free tier cold-starts in ~1 min, then the first refresh fetches every source
            with urllib.request.urlopen(req, timeout=240) as r:
                return r.read()
        except Exception as e:  # noqa: BLE001
            print(f"attempt {i + 1}/{attempts} failed: {e}", file=sys.stderr)
            if i + 1 < attempts:
                time.sleep(30 * (i + 1))
    raise SystemExit("could not fetch snapshot")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--api", default=os.getenv("AEROFUSION_API", "https://aerofusion-api.onrender.com"))
    ap.add_argument("--out", default="backend/data/archive/snapshots")
    args = ap.parse_args()

    body = fetch(args.api)
    snap = json.loads(body)
    stamp = snap.get("updated_at")
    if not stamp:
        raise SystemExit("snapshot has no updated_at")
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    f = out / f"snapshot_{stamp.replace(':', '-')}.json.gz"
    if f.exists():
        print(f"exists: {f.name}")
        return
    with gzip.open(f, "wb") as g:
        g.write(body)
    ok = sum(1 for s in snap.get("sources", []) if s.get("ok"))
    print(f"saved: {f.name} ({f.stat().st_size // 1024} KB, {ok}/{len(snap.get('sources', []))} sources ok)")


if __name__ == "__main__":
    main()
