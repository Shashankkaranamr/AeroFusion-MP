"""Copernicus ADS (CAMS, S4/S5) and CDS (ERA5, S3) monthly requests (PROGRESS P1.6, P1.7). CC-BY-4.0.

One ECMWF token in ~/.cdsapirc serves both portals (verified 2026-10-15); the url line in the file is ignored here.
Jobs are submitted once and their request_ids are kept in `<out>/jobs.json`, so a restart polls instead of resubmitting.
Never prints the token.
"""

from __future__ import annotations

import calendar
import json
import os
import threading
import time
from pathlib import Path

from . import manifest

PORTALS = {"ads": "https://ads.atmosphere.copernicus.eu/api", "cds": "https://cds.climate.copernicus.eu/api"}
AREA = [38, 66, 5, 98]  # N, W, S, E: PROGRESS §3.2 India bbox
CAMS_FC = "cams-global-atmospheric-composition-forecasts"
ERA5 = "reanalysis-era5-single-levels"
_lock = threading.Lock()


def token() -> str:
    f = Path(os.getenv("CDSAPI_RC", Path.home() / ".cdsapirc"))
    pairs = (line.split(":", 1) for line in f.read_text(encoding="utf-8").splitlines() if ":" in line) if f.exists() else ()
    key = {k.strip(): v.strip() for k, v in pairs}.get("key")
    if not key:
        raise SystemExit("~/.cdsapirc has no key line (see PROGRESS P0.7)")
    return key


def client(portal: str):
    from ecmwf.datastores import Client

    return Client(url=PORTALS[portal], key=token())


def months(start: str, end: str) -> list[str]:
    y, m = map(int, start.split("-"))
    ey, em = map(int, end.split("-"))
    out = []
    while (y, m) <= (ey, em):
        out.append(f"{y:04d}-{m:02d}")
        y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    return out


def _days(month: str) -> tuple[int, int, int]:
    y, m = map(int, month.split("-"))
    return y, m, calendar.monthrange(y, m)[1]


def cams_fc_request(month: str) -> dict:
    """00 & 12 UTC runs, leads 0..48 h every 3 h, PM2.5 + total/dust AOD550, native 0.4°, India bbox."""
    y, m, n = _days(month)
    return {
        "variable": ["particulate_matter_2.5um", "total_aerosol_optical_depth_550nm", "dust_aerosol_optical_depth_550nm"],
        "date": [f"{y:04d}-{m:02d}-01/{y:04d}-{m:02d}-{n:02d}"],
        "time": ["00:00", "12:00"],
        "leadtime_hour": [str(h) for h in range(0, 49, 3)],
        "type": ["forecast"],
        "area": AREA,
        "data_format": "netcdf_zip",
    }


def era5_request(month: str) -> dict:
    """u10, v10, BLH, t2m every 3 h at native 0.25°, India bbox (regridded to §3.2 grid in P1.10)."""
    y, m, n = _days(month)
    return {
        "product_type": ["reanalysis"],
        "variable": ["10m_u_component_of_wind", "10m_v_component_of_wind", "boundary_layer_height", "2m_temperature"],
        "year": [f"{y:04d}"],
        "month": [f"{m:02d}"],
        "day": [f"{d:02d}" for d in range(1, n + 1)],
        "time": [f"{h:02d}:00" for h in range(0, 24, 3)],
        "area": AREA,
        "data_format": "netcdf",
        "download_format": "unarchived",
    }


SOURCES = {
    # name: (portal, collection, request builder, file suffix)
    "cams_fc": ("ads", CAMS_FC, cams_fc_request, ".zip"),
    "era5_grid": ("cds", ERA5, era5_request, ".nc"),
}


def _jobs(out: Path) -> dict[str, str]:
    f = out / "jobs.json"
    return json.loads(f.read_text(encoding="utf-8")) if f.exists() else {}


def _save_jobs(out: Path, jobs: dict[str, str]) -> None:
    out.mkdir(parents=True, exist_ok=True)
    tmp = out / "jobs.tmp"
    tmp.write_text(json.dumps(dict(sorted(jobs.items())), indent=1), encoding="utf-8")
    tmp.replace(out / "jobs.json")


def _reason(portal: str, request_id: str) -> str:
    """The portal's error text for a failed/rejected job (the job record itself carries none)."""
    import httpx

    try:
        r = httpx.get(f"{PORTALS[portal]}/retrieve/v1/jobs/{request_id}/results", headers={"PRIVATE-TOKEN": token()}, timeout=60)
        j = r.json()
        return str(j.get("traceback") or j.get("detail") or j.get("title") or "").strip()
    except Exception as e:  # noqa: BLE001 - diagnostics only
        return type(e).__name__


QUEUE_LIMIT = "queued requests for this dataset is temporarily limited"


def run(source: str, month_list: list[str], max_active: int = 6, poll_s: int = 60, log=print) -> None:
    """Keep up to `max_active` jobs queued on the portal; download each as it completes. Idempotent and resumable.

    A rejection for the per-user queue limit is not a failure: the month is requeued and the active cap is lowered.
    """
    portal, collection, build, suffix = SOURCES[source]
    out = manifest.RAW / source / "v1"
    known = manifest.load()
    done = {m for m in month_list if (out / f"{m}{suffix}").resolve().relative_to(manifest.RAW.resolve()).as_posix() in known}
    todo = [m for m in month_list if m not in done]
    log(f"{source}: {len(month_list)} months, {len(done)} already downloaded, {len(todo)} to fetch")
    c = client(portal)
    jobs = _jobs(out)
    pending, fails, limit = list(todo), {}, max_active
    while pending:
        active = [m for m in pending if m in jobs]
        for m in [m for m in pending if m not in jobs][: max(0, limit - len(active))]:
            try:
                jobs[m] = c.submit(collection, build(m)).request_id
            except Exception as e:  # noqa: BLE001 - transient portal/network errors: retry next round
                log(f"  submit {m} failed ({type(e).__name__}); retrying later")
                break
            _save_jobs(out, jobs)
            log(f"  submitted {m}")
        for m in [m for m in pending if m in jobs]:
            try:
                r = c.get_remote(jobs[m])
                status = r.status
                if status == "successful":
                    dest = out / f"{m}{suffix}"
                    part = dest.with_name(dest.name + ".part")
                    r.download(str(part))
                    part.replace(dest)
                    with _lock:
                        manifest.record(dest, f"{PORTALS[portal]}/retrieve/v1/jobs/{jobs[m]}", source=source, collection=collection, request=build(m))
                    pending.remove(m)
                    log(f"  downloaded {m} ({dest.stat().st_size / 1e6:.1f} MB); {len(pending)} left")
            except Exception as e:  # noqa: BLE001
                log(f"  poll {m} failed ({type(e).__name__}); retrying later")
                continue
            if status in ("failed", "rejected", "dismissed", "deleted"):
                reason = _reason(portal, jobs[m])
                del jobs[m]
                _save_jobs(out, jobs)
                if QUEUE_LIMIT in reason:
                    limit = max(1, min(limit, len(active)) - 1)
                    log(f"  {m} rejected by the queue limit; requeued, active cap now {limit}")
                    continue
                fails[m] = fails.get(m, 0) + 1
                if fails[m] >= 2:
                    pending.remove(m)
                    log(f"  {m} {status} twice, giving up: {reason[:300]}")
                else:
                    log(f"  {m} {status}: {reason[:300]}; resubmitting")
        if pending:
            time.sleep(poll_s)
    missing = [m for m in month_list if fails.get(m, 0) >= 2]
    log(f"{source}: finished" + (f"; FAILED months: {missing}" if missing else ", all months downloaded"))
