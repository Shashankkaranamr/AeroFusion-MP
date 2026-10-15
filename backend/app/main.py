"""AeroFusion API.

Run:  uvicorn app.main:app --reload --port 8000   (from the backend/ folder)
"""

from __future__ import annotations

import asyncio
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

import time  # noqa: E402

import httpx  # noqa: E402

from .live import ai as AI  # noqa: E402
from .live import sources as S  # noqa: E402
from .live.service import LiveService  # noqa: E402
from .sim.core import CITY_BY_SLUG  # noqa: E402

live = LiveService(interval_s=int(os.getenv("AEROFUSION_REFRESH_SECONDS", "43200")))


@asynccontextmanager
async def lifespan(_: FastAPI):
    live.start()
    watcher = asyncio.create_task(_ai_watcher())
    yield
    watcher.cancel()
    await live.stop()


app = FastAPI(title="AeroFusion API", version="0.2.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in os.getenv("AEROFUSION_CORS", "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173").split(",") if o.strip()],
    # e.g. https://.*\.vercel\.app for Vercel production + preview URLs
    allow_origin_regex=os.getenv("AEROFUSION_CORS_REGEX") or None,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- per-IP rate limits on endpoints that cost money / upstream quota ----------
_LIMITS = [  # (path prefix, method, max requests, window seconds)
    ("/api/ai/chat", "POST", int(os.getenv("RL_CHAT_PER_MIN", "6")), 60),
    ("/api/ai/chat", "POST", int(os.getenv("RL_CHAT_PER_DAY", "80")), 86400),
    ("/api/live/refresh", "POST", 2, 60),
    ("/api/ai/insights?force", "GET", 3, 300),
]
_hits: dict[tuple[str, str, int], list[float]] = {}


@app.middleware("http")
async def rate_limit(request, call_next):
    path = request.url.path + ("?force" if request.query_params.get("force") in ("1", "true") else "")
    ip = (request.headers.get("x-forwarded-for") or (request.client.host if request.client else "?")).split(",")[0].strip()
    now = time.time()
    for prefix, method, limit, window in _LIMITS:
        if request.method == method and path.startswith(prefix):
            key = (ip, prefix, window)
            q = [t for t in _hits.get(key, []) if now - t < window]
            if len(q) >= limit:
                from fastapi.responses import JSONResponse

                return JSONResponse({"detail": f"Rate limit: max {limit} requests per {window // 60 or 1} min. Try again shortly."}, status_code=429, headers={"Retry-After": str(int(window - (now - q[0])) + 1)})
            q.append(now)
            _hits[key] = q
    if len(_hits) > 20000:
        _hits.clear()
    return await call_next(request)


@app.get("/health")
def health():
    return {"status": "ok", "last_refresh": live.snapshot["updated_at"] if live.snapshot else None}


@app.get("/api/live/status")
def live_status():
    return {
        "updated_at": live.snapshot["updated_at"] if live.snapshot else None,
        "next_refresh_in": live.next_refresh_in(),
        "interval_s": live.interval_s,
        "refreshing": live.lock.locked(),
        "sources": live.sources_status(),
    }


@app.get("/api/live/snapshot")
async def live_snapshot():
    if live.snapshot is None:
        await live.refresh()
    return {**live.snapshot, "next_refresh_in": live.next_refresh_in()}


@app.post("/api/live/refresh")
async def live_refresh():
    if live.lock.locked():
        raise HTTPException(409, "A refresh is already running")
    snap = await live.refresh()
    return {**snap, "next_refresh_in": live.next_refresh_in()}


_cache: dict[str, tuple[float, dict]] = {}


async def _cached(key: str, ttl: float, fn):
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < ttl:
        return hit[1]
    val = await fn()
    _cache[key] = (time.time(), val)
    return val


@app.get("/api/history")
async def history_all():
    """Measured monthly PM2.5 for all cities from the CPCB archive (XKDR), 2022–2024."""
    key = os.getenv("XKDR_API_KEY")
    if not key:
        raise HTTPException(503, "XKDR_API_KEY not configured")

    async def run():
        async with httpx.AsyncClient(timeout=120) as client:
            return await S.cpcb_history_all(client, key)

    return await _cached("hist:all", 24 * 3600, run)


@app.get("/api/history/{city}")
async def history(city: str):
    """Measured monthly PM2.5 from the CPCB archive (XKDR) for 2022–2024."""
    c = CITY_BY_SLUG.get(city)
    if not c:
        raise HTTPException(404, "unknown city")
    key = os.getenv("XKDR_API_KEY")
    if not key:
        raise HTTPException(503, "XKDR_API_KEY not configured")

    async def run():
        async with httpx.AsyncClient(timeout=90) as client:
            return await S.cpcb_history(client, key, c)

    return await _cached(f"hist:{city}", 24 * 3600, run)


@app.get("/api/archive")
async def archive():
    """Size and coverage of the measured CPCB archive available for training."""
    key = os.getenv("XKDR_API_KEY")
    if not key:
        raise HTTPException(503, "XKDR_API_KEY not configured")

    async def run():
        async with httpx.AsyncClient(timeout=90) as client:
            return await S.cpcb_meta(client, key)

    return await _cached("archive", 12 * 3600, run)


@app.get("/api/tensor")
def tensor_info():
    """Rolling live tensor saved for the model."""
    import numpy as np

    f = live.data_dir / "live_tensor.npz"
    if not f.exists():
        return {"exists": False}
    d = np.load(f)
    X = d["X"]
    return {
        "exists": True,
        "shape": list(X.shape),
        "timestamps": [str(t) for t in d["timestamps"]],
        "features": [str(x) for x in d["features"]],
        "coverage_per_feature": [round(float(v), 4) for v in np.isfinite(X).mean(axis=(0, 1))],
        "size_kb": round(f.stat().st_size / 1024, 1),
    }


class _AiState:
    """Insights are generated in the background (slow on CPU-only Ollama) and served from cache."""

    def __init__(self, choice: str = "auto"):
        self.choice = choice
        self.data: dict | None = None  # last good insights
        self.generating = False
        self.error: str | None = None
        self.started_at: float | None = None
        self.task: asyncio.Task | None = None

    def kick(self, snap: dict) -> None:
        if self.generating:
            return
        self.generating, self.error, self.started_at = True, None, time.time()

        async def run():
            try:
                self.data = await AI.insights(snap, AI.resolve_chain(self.choice))
            except Exception as e:  # noqa: BLE001
                self.error = str(e)
                print(f"[ai] insights failed: {e}")
            finally:
                self.generating = False

        self.task = asyncio.create_task(run())


ai_states: dict[str, _AiState] = {"auto": _AiState("auto")}
ai_state = ai_states["auto"]


def _state_for(choice: str) -> _AiState:
    if choice not in ai_states:
        ai_states[choice] = _AiState(choice)
    return ai_states[choice]


async def _ai_watcher():
    """Pre-generate insights whenever the live snapshot changes."""
    seen = None
    while True:
        snap = live.snapshot
        if snap and snap["updated_at"] != seen and not ai_state.generating:
            seen = snap["updated_at"]
            ai_state.kick(snap)
        await asyncio.sleep(20)


@app.get("/api/ai/provider")
def ai_provider():
    """Configured LLM chain and selectable models (no secrets)."""
    return {**AI.provider_info(), "options": AI.options()}


@app.get("/api/ai/insights")
async def ai_insights(force: bool = False, provider: str = "auto"):
    """Latest AI insight cards. Never blocks on the LLM: returns the cached set plus generation status."""
    try:
        AI.resolve_chain(provider)
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    if live.snapshot is None:
        await live.refresh()
    snap = live.snapshot
    ai_state = _state_for(provider)
    fresh = ai_state.data is not None and ai_state.data.get("updated_at") == snap["updated_at"]
    if force or (not fresh and not ai_state.generating):
        ai_state.kick(snap)
    return {
        **(ai_state.data or {"headline": "", "insights": [], "updated_at": None, "model": None}),
        "generating": ai_state.generating,
        "generating_for_s": round(time.time() - ai_state.started_at) if ai_state.generating and ai_state.started_at else 0,
        "error": ai_state.error,
        "stale": not fresh,
    }


@app.post("/api/ai/chat/stream")
async def ai_chat_stream(body: dict):
    """Streamed chat answer (plain text chunks) grounded in the current live snapshot."""
    if live.snapshot is None:
        await live.refresh()
    try:
        chain = AI.resolve_chain(body.get("provider"))
    except ValueError as e:
        raise HTTPException(400, str(e)) from e
    return StreamingResponse(AI.chat_stream(live.snapshot, body.get("messages", []), body.get("city"), chain), media_type="text/plain; charset=utf-8")


@app.post("/api/ai/chat")
async def ai_chat(body: dict):
    """Chat grounded in the current live snapshot. Body: {messages:[{role,content}], city?}."""
    if live.snapshot is None:
        await live.refresh()
    try:
        answer = await AI.chat(live.snapshot, body.get("messages", []), body.get("city"))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, str(e)) from e
    return {"answer": answer, "updated_at": live.snapshot["updated_at"]}
