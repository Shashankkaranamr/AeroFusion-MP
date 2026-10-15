"""Runtime settings from environment variables."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


@dataclass(frozen=True)
class Settings:
    #: "demo" (simulator) or "model" (serve artefacts from a logged training run)
    provider: str = field(default_factory=lambda: os.getenv("AEROFUSION_PROVIDER", "demo"))
    #: Run directory produced by `python -m aerofusion.train` (used when provider == "model")
    run_dir: Path | None = field(default_factory=lambda: Path(p) if (p := os.getenv("AEROFUSION_RUN_DIR")) else None)
    cors_origins: tuple[str, ...] = field(
        default_factory=lambda: tuple(o.strip() for o in os.getenv("AEROFUSION_CORS", "http://localhost:3000,http://127.0.0.1:3000").split(","))
    )
    version: str = "0.1.0"


settings = Settings()
