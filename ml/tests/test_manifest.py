"""MANIFEST.json writes from several download processes at once (2026-11-03: concurrent FIRMS/ERA5/CAMS writers on
Windows crashed with OSError on the shared .tmp file and could drop each other's entries)."""

import json
import multiprocessing as mp
from pathlib import Path

from aerofusion_ml.data import manifest


def _writer(folder: str, idx: int, n: int) -> None:
    root = Path(folder)
    for k in range(n):
        f = root / f"w{idx}_{k}.bin"
        f.write_bytes(bytes([idx, k]))
        manifest.record(f, f"url{idx}-{k}", manifest=root / "MANIFEST.json")


def test_concurrent_processes_keep_every_entry(tmp_path):
    procs = [mp.Process(target=_writer, args=(str(tmp_path), i, 15)) for i in range(4)]
    for p in procs:
        p.start()
    for p in procs:
        p.join(60)
    assert all(p.exitcode == 0 for p in procs)
    m = json.loads((tmp_path / "MANIFEST.json").read_text(encoding="utf-8"))
    assert len(m) == 60 and m["w3_14.bin"]["url"] == "url3-14"
    assert not list(tmp_path.glob("*.tmp")) and not (tmp_path / "MANIFEST.lock").exists()


def test_stale_lock_from_killed_process_is_taken_over(tmp_path):
    import os
    import time

    lock = tmp_path / "MANIFEST.lock"
    lock.write_text("")
    old = time.time() - 3600
    os.utime(lock, (old, old))
    f = tmp_path / "a.bin"
    f.write_bytes(b"a")
    manifest.record(f, "u", manifest=tmp_path / "MANIFEST.json")
    assert "a.bin" in manifest.load(tmp_path / "MANIFEST.json") and not lock.exists()
