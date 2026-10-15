"""Check that every data-source credential is present and accepted (PROGRESS P0.7). Never prints key values.

    python ml/scripts/check_keys.py
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import httpx

ML = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ML))
from aerofusion_ml.env import load_env  # noqa: E402

DATAGOVIN_AQI = "3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69"  # "Real time Air Quality Index from various locations"


def cdsapirc() -> dict[str, str]:
    f = Path(os.getenv("CDSAPI_RC", Path.home() / ".cdsapirc"))
    if not f.exists():
        return {}
    pairs = (line.split(":", 1) for line in f.read_text(encoding="utf-8").splitlines() if ":" in line)
    return {k.strip(): v.strip() for k, v in pairs}


def check(name: str, key: str | None, fn) -> bool:
    if not key or key.endswith("_here"):
        print(f"[missing] {name}")
        return False
    try:
        ok, detail = fn(key)
    except httpx.HTTPError as e:
        ok, detail = False, type(e).__name__
    detail = detail.replace(key, "***")
    print(f"[{'ok' if ok else 'FAILED'}] {name}: {detail}")
    return ok


def main() -> None:
    env = load_env()
    c = httpx.Client(timeout=60, follow_redirects=True)

    def xkdr(k):
        r = c.get("https://airquality.xkdr.org/v1/stations", headers={"Authorization": f"Bearer {k}"})
        return r.status_code == 200, f"HTTP {r.status_code}" + (f", {len(r.json().get('data', []))} stations" if r.status_code == 200 else "")

    def firms(k):
        r = c.get(f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{k}/VIIRS_SNPP_NRT/76,28,78,29/1")
        ok = r.status_code == 200 and r.text.startswith("latitude")
        return ok, f"HTTP {r.status_code}" + ("" if ok else f", {r.text[:80].strip()!r}")

    def openaq(k):
        r = c.get("https://api.openaq.org/v3/locations", params={"limit": 1, "iso": "IN"}, headers={"X-API-Key": k})
        return r.status_code == 200, f"HTTP {r.status_code}"

    def datagovin(k):
        r = c.get(f"https://api.data.gov.in/resource/{DATAGOVIN_AQI}", params={"api-key": k, "format": "json", "limit": 1})
        ok = r.status_code == 200 and "records" in r.text
        return ok, f"HTTP {r.status_code}" + ("" if ok else f", {r.text[:80].strip()!r}")

    def cds(k):
        rc = cdsapirc()
        ok = rc.get("url", "").startswith("https://cds.climate.copernicus.eu/api") and len(k) >= 20
        return ok, "file format ok (token is validated on the first download)" if ok else f"url should be https://cds.climate.copernicus.eu/api, got {rc.get('url')!r}"

    checks = [
        ("XKDR_API_KEY (CPCB archive)", env.get("XKDR_API_KEY"), xkdr),
        ("FIRMS_MAP_KEY", env.get("FIRMS_MAP_KEY"), firms),
        ("OPENAQ_API_KEY (live stations)", env.get("OPENAQ_API_KEY"), openaq),
        ("DATAGOVIN_KEY (live stations, backup)", env.get("DATAGOVIN_KEY"), datagovin),
        ("~/.cdsapirc (Copernicus CDS + ADS)", cdsapirc().get("key"), cds),
    ]
    ok = [check(*c) for c in checks]
    print(f"\n{sum(ok)}/{len(ok)} ready. Live stations need OpenAQ or data.gov.in (one is enough).")


if __name__ == "__main__":
    main()
