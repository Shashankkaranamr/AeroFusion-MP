# AeroFusion

**Explainable PM2.5 air-quality monitoring and forecasting for 33 Indian cities.**
A scroll-driven story about one particle of pollution, which hands over to a live dashboard. Behind both: a multi-source data-fusion backend (Copernicus CAMS, Open-Meteo, NASA FIRMS, NASA GIBS, CPCB archive) and an LLM analyst (Amazon Nova Micro on Bedrock, Groq fallback) that explains what is driving pollution right now. Status and remaining work: [PROGRESS.md](PROGRESS.md).

**API:** https://aerofusion-api.onrender.com ([health](https://aerofusion-api.onrender.com/health))

> Forecasts shown are Copernicus CAMS; no custom-model accuracy is claimed.

---

## The site

| Part | What it is |
|---|---|
| **Story** (`index.html`) | Six scroll-driven scenes (Three.js, GSAP, Lenis): the particle, the spark, the ride, the trap, the breath, not alone. It ends with every particle gathering into the orange blob, which becomes the logo, then asks "Where do you breathe?" and hands over to the dashboard. Autoplay, Skip and Sound controls. |
| **Dashboard** (`app.html`) | React. Seven views, all on live data (below). The logo sits exactly where the story leaves it. |

| View | What it shows |
|---|---|
| **Now** | National average, cities above the limit, people exposed, fires; 33-city ranking; 24 h alerts; your city; the AI's read; quick actions |
| **Map** | India state boundaries, city PM2.5, heat layer, NASA FIRMS fires (upwind of your city lit brighter), animated wind, transport arrows with shares, six GIBS satellite layers, −48 h → +96 h scrubber. Arriving from the story, the particles fly out to the cities |
| **City** | PM2.5, AQI and advice; pollutants; weather; 4-day forecast with AQI bands, peak and best/worst 3 h; ventilation; CPCB baseline; source shares; nearby fires; satellite compare; rule-based insights |
| **Why** | AI insight cards (model picker, regenerate), Spearman drivers across cities and hours, scatter, daily cycle, z-score heatmap |
| **What if** | Five presets and seven levers on the live CAMS forecast: before → after |
| **History** | CPCB 2022–2024 monthly, 2024 calendar heatmap, worst day, multi-city comparison, stations, CSV/JSON/Markdown, print |
| **Behind the data** | The pipeline as Hairline figures (sources → fusion → tensor → AI), source health, NASA imagery, tensor heatmap and features, CPCB archive, wind graph, roadmap, honesty notes, credits |

Everywhere: live status and next-refresh countdown, source health, manual refresh, "Ask the data" (streamed chat from any view), an ember cursor that follows the mouse, optional sound, Dusk/Dawn themes from the system setting, reduced-motion support.

## Data sources

| Source | Used for | Key |
|---|---|---|
| Copernicus **CAMS** via Open-Meteo Air Quality | Live + forecast PM2.5, PM10, AOD, dust, NO₂, CO | none |
| **Open-Meteo** forecast | Temperature, humidity, wind, pressure, rain, boundary-layer height | none |
| **NASA FIRMS** (VIIRS, 24 h) | Active fires, FRP, upwind fire counts | none |
| **NASA GIBS** | Satellite imagery (true colour, AOD, thermal) | none |
| **XKDR India Air Quality API** (CPCB CAAQMS) | Measured history & same-month baselines | `XKDR_API_KEY` |
| **Amazon Bedrock** (Nova Micro) — primary | AI insights & chat on Explainability | `AWS_BEARER_TOKEN_BEDROCK` |
| **Groq** (`gpt-oss-120b` / `gpt-oss-20b`) — fallback | Used automatically if Bedrock fails | `GROQ_API_KEY` |
| **Ollama** (optional, self-hosted) | Extra fallback / offline | `OLLAMA_URL` |

Every refresh (every 12 h, `AEROFUSION_REFRESH_SECONDS=43200`, or on demand) fuses these into a `(time ≤ 72, cities = 33, features = 20)` tensor saved to `backend/data/processed/live_tensor.npz`.

## Architecture

```
frontend/   Vite · vanilla JS story (Three.js, GSAP, Lenis)
            + React 19 dashboard (Tailwind v4, Motion, Recharts, MapLibre, Radix, Hairline)
   └─ src/app/lib/api.ts ──HTTP (/api, proxied in dev)──▶ backend/  FastAPI
                                ├─ live/sources.py   fetchers (CAMS, Open-Meteo, FIRMS, GIBS, XKDR)
                                ├─ live/service.py   refresh loop + fusion → tensor
                                └─ live/ai.py        LLM chain Bedrock → Groq (→ Ollama): insights & chat
legacy-dashboard/   the previous Next.js dashboard, kept for reference only
```

### API

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Liveness + last refresh |
| GET | `/api/live/status` | Last update, countdown, source health |
| GET | `/api/live/snapshot` | Full fused snapshot (cities, series, fires, GIBS, tensor) |
| POST | `/api/live/refresh` | Refresh all sources now |
| GET | `/api/history` · `/api/history/{city}` | CPCB monthly (2022–2024) / daily 2024 |
| GET | `/api/archive` | CPCB archive size & coverage |
| GET | `/api/tensor` | Saved tensor shape, timestamps, coverage |
| GET | `/api/ai/provider` | Configured LLM chain (no secrets) |
| GET | `/api/ai/insights?force=1` | AI insight cards (generated in background; returns cache + `generating` status) |
| POST | `/api/ai/chat` · `/api/ai/chat/stream` | `{messages:[{role,content}], city?}` → grounded answer (streamed) |

## Deployment
| Part | Host | Notes |
|---|---|---|
| Frontend | Any static host (Vercel, Netlify, Pages): root `frontend/`, build `npm run build`, output `dist/` | set `VITE_API_URL=https://aerofusion-api.onrender.com` at build time, and add the site's origin to the API's `AEROFUSION_CORS` (or `AEROFUSION_CORS_REGEX`) |
| Backend | **Render** free web service via [`render.yaml`](render.yaml), auto-deploys on push | secrets `XKDR_API_KEY`, `AWS_BEARER_TOKEN_BEDROCK`, `GROQ_API_KEY` set in Render; refresh every 12 h |

Render's free plan sleeps after ~15 min idle; the first visit wakes it (~1 min, the UI shows a "connecting" card and retries automatically).
Weather falls back from Open-Meteo to MET Norway when the shared cloud IP is rate-limited.

## Run locally

**Requirements:** Node 20+, Python 3.11+.

```bash
# 1. Backend
python -m venv .venv
.venv/Scripts/activate            # Windows  (macOS/Linux: source .venv/bin/activate)
pip install -r backend/requirements.txt
cp backend/.env.example backend/.env   # then fill in XKDR_API_KEY, AWS_BEARER_TOKEN_BEDROCK, GROQ_API_KEY
python -m uvicorn app.main:app --app-dir backend --port 8000

# 2. Frontend (new terminal)
cd frontend
npm install
npm run dev                        # story: http://localhost:5173 · dashboard: /app.html
```

In dev, Vite proxies `/api` to the deployed API. To use the local backend instead, start it and run the frontend with `AEROFUSION_API=http://localhost:8000 npm run dev`.

`backend/.env`:

```ini
XKDR_API_KEY=...                   # https://airquality.xkdr.org
AI_PROVIDERS=bedrock,groq         # tried in order
AWS_BEARER_TOKEN_BEDROCK=...       # Bedrock console → API keys
BEDROCK_REGION=us-east-1
BEDROCK_MODEL=us.amazon.nova-micro-v1:0
GROQ_API_KEY=...                   # https://console.groq.com (fallback)
GROQ_MODEL=openai/gpt-oss-120b
AEROFUSION_REFRESH_SECONDS=600
```


## Honesty notes
- Live PM2.5 is the **CAMS model** (~40 km grid), labelled as such everywhere — not a ground measurement.
- The CPCB archive is historical (most stations to Dec 2024), used for baselines and history.
- AI text is generated by an LLM from the live numbers and can be wrong; the charts are the source of truth.
- No custom forecasting model is trained (out of scope); Model Lab shows the training data and readiness for future work.

## Roadmap
Deploy (Vercel + hosted API) → rate-limit AI endpoints → cleanup & CI. Training MW-AeroFusion-Net is future work. Full checklist in [PROGRESS.md](PROGRESS.md#-whats-left-current-scope).

## Credits
India boundaries: DataMeet (CC BY 4.0) · Imagery: NASA GIBS / Worldview · Fires: NASA FIRMS · Air-quality model: Copernicus CAMS · Weather: Open-Meteo · Labels/basemaps: Esri · Measurements: CPCB via XKDR.
