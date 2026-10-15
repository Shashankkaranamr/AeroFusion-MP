"""S8 collector: CPCB hourly PM2.5 from OpenAQ for the panel stations (prospective test 2026-10-15 -> 2027-02-28).

    python ml/scripts/collect_openaq.py --match                  # once: write ml/data/openaq_match_v1.csv
    python ml/scripts/collect_openaq.py --months 2026-10 2026-11 # fetch (re-run monthly; the current month is refetched)

Writes ml/data/raw/openaq/v1/<station_id>/<YYYY-MM>.parquet (t UTC slot, value). Months before 2026-10 are refused:
they overlap frozen or unused periods and are not needed for the prospective test.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd

ML = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ML))
from aerofusion_ml.data import openaq  # noqa: E402

MATCH = ML / "data" / "openaq_match_v1.csv"
FIRST_MONTH = "2026-10"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--match", action="store_true")
    ap.add_argument("--months", nargs="*", default=[])
    a = ap.parse_args()
    c = openaq.client()
    if a.match:
        panel = pd.read_csv(ML / "data" / "stations_v1.csv")
        m = openaq.match_stations(c, panel)
        m.to_csv(MATCH, index=False)
        ok = m["openaq_location"].notna()
        print(f"matched {int(ok.sum())}/{len(m)} panel stations within {openaq.MATCH_KM} km; current sensor last hour: "
              f"{m.loc[ok, 'sensor_last'].max()}")
    if a.months:
        if min(a.months) < FIRST_MONTH:
            raise SystemExit(f"months before {FIRST_MONTH} are not collected (frozen/unused periods)")
        m = pd.read_csv(MATCH).dropna(subset=["pm25_sensor"])
        for month in a.months:
            n = 0
            for s in m.itertuples():
                n += len(pd.read_parquet(openaq.fetch_month(c, s.station_id, int(s.pm25_sensor), month)))
            print(f"{month}: {n:,} station-hours from {len(m)} stations")


if __name__ == "__main__":
    main()
