# AeroFusion — progress & checkpoints

> Resume point for anyone (human or AI). Update after every milestone. Last update: **2026-10-10** · tag `checkpoint-2026-10-10b`.

```
Overall (current scope)      ███████████████████░  95%
Frontend UI (12 pages)       ████████████████████ 100%  Liquid Glass, light/dark, photo backgrounds, sounds
Live data backend            ████████████████████ 100%  6 sources → fusion → (T,33,20) tensor, auto-refresh every 12 h
Dashboards on real data      ████████████████████ 100%  no simulated values left in any dashboard
AI explainability            ████████████████████ 100%  model picker: Nova Micro (Bedrock) / Groq, auto-fallback, streamed chat
Docs                         ████████████████░░░░  80%  README + this file (screenshots missing)
Code cleanup & security      ████████░░░░░░░░░░░░  40%  rate limits done; unused simulator code left
Tests / CI                   █░░░░░░░░░░░░░░░░░░░   5%
Deployment (public URL)      ████████████████████ 100%  https://aerofusion.vercel.app + Render API
```

> **Scope decision (2026-10-10):** training MW-AeroFusion-Net is **out of scope**. AeroFusion ships as a live
> multi-source monitoring + CAMS forecast + AI-explanation platform. The live tensor and CPCB archive access remain
> in place if training is picked up later (see "Future work").

---

## ✅ Done

### Frontend (`frontend/`)
- [x] Next.js 16 · React 19 · Tailwind v4 · Motion · Lenis · Recharts · MapLibre GL 6
- [x] Apple Liquid Glass design system (`glass`, `glass-hero`, `card` … in `globals.css`), floating sidebar/toolbar, mobile tab bar, light + dark
- [x] Photo backgrounds (home: stitched bg1–3; app: `public/hero/app-bg.webp`); fonts Christmas Mallow (headers) + Papernotes (cards)
- [x] Sounds: water-drop click on every button/link; looping sunrise ambience only on `/`; persisted mute toggle
- [x] Shared `LiveProvider` (`hooks/use-live.ts`) — one connection, status poll every 15 s, countdown, manual refresh
- [x] **All dashboards on real data**
  - Overview — national avg, cities > NAAQS, exposure, fires, NASA satellite map, 24 h alerts, rankings, live signals
  - Forecast — CAMS hourly (−24 h … +96 h), CPCB baseline line, ventilation chart, best/worst windows, insights
  - Live Map — NASA GIBS satellite + Esri labels, PM2.5 heat, FIRMS fires, MODIS AOD, **animated wind particles**, **animated transport arrows into selected city (share %)**, time scrubber
  - Explainability — Spearman drivers (cross-city & hourly), scatter, daily cycle, z-scores, **Groq AI insight cards with reasoning**, **chat**, single **Refresh everything** button
  - Model Lab — real CPCB archive stats, tensor coverage, live wind graph, honest training checklist (no fake metrics)
  - Reports — CPCB 2022–2024 monthly/daily, 2024 calendar, multi-city trends, CSV/JSON/MD downloads, print
  - What-if Simulator — sensitivity surrogate on the live CAMS baseline; fire share from live FIRMS
  - Data Sources / Live Data — 6 sources with health, NASA image cards, unified tensor heatmap
  - Home — live Delhi card, city list, chart, sources, fires; topbar Live/Offline pill + CAMS alerts
- [x] Architecture diagram, illustrative metrics and demo-mode labels removed

### Backend (`backend/`)
- [x] FastAPI app, background refresh loop (12 h; weather cached 30 min, retry + last-good fallback), CORS for localhost:3000
- [x] Sources: CAMS (Open-Meteo AQ), Open-Meteo weather, NASA FIRMS (VIIRS 24 h), NASA GIBS (WMS/WMTS), XKDR CPCB archive (key), calendar
- [x] Fusion → `(T ≤ 72, N = 33, F = 20)` tensor saved to `backend/data/processed/live_tensor.npz`
- [x] Endpoints: `/health`, `/api/live/{status,snapshot,refresh}`, `/api/history`, `/api/history/{city}`, `/api/archive`, `/api/tensor`, `/api/ai/insights`, `/api/ai/chat`
- [x] LLM layer (`app/live/ai.py`): provider chain `AI_PROVIDERS=bedrock,groq` (Amazon Nova Micro primary, Groq fallback, optional Ollama), compact grounded context, insights pre-generated in background after each refresh, streamed chat, empty/429 handling

---

## ⏳ What's left (current scope)

### 1. Deployment — ✅ done (2026-10-10)
- [x] Frontend on Vercel: https://aerofusion.vercel.app (auto-deploy from `main`, root `frontend/`)
- [x] Backend on Render free: https://aerofusion-api.onrender.com (`render.yaml`, secrets in Render)
- [x] Refresh every 12 h; Open-Meteo 429 → retry → MET Norway fallback; last-good data kept on failures
- [ ] Optional: always-on backend (Render paid / AWS) to avoid the ~1 min cold start after idle

### 2. Security & cost control
- [x] Rate-limit `/api/ai/*` and `/api/live/refresh` (per-IP): chat 6/min & 80/day, refresh 2/min, forced AI 3/5 min
- [ ] AWS Budgets alert on the Bedrock credit; rotate the Bedrock key that was shared in chat
- [ ] Switch `BEDROCK_REGION=ap-south-1`, `BEDROCK_MODEL=apac.amazon.nova-micro-v1:0` once AWS account verification finishes

### 3. Cleanup
- [ ] Delete unused demo simulator: `frontend/src/lib/sim/*`, `hooks/use-anchor.ts` (move `HOUR_MS`/`useClock` into `lib/format.ts`), `components/map/scales.ts` if unused, `backend/app/sim/*` (keep the city list)
- [ ] Remove the leftover Ollama provider if it will never be used (or keep as an offline option)

### 4. Tests / CI
- [ ] pytest for fusion + AI context builder with mocked sources; GitHub Actions running `tsc`, `eslint`, `next build`, `pytest`

### 5. Polish (optional)
- [ ] README screenshots / short demo GIF; 4K background artwork; mobile pass on Live Map & Explainability
- [ ] Remember the chosen AI model across reloads

### Future work (out of current scope)
- Historical backfill (CAMS reanalysis + ERA5 + FIRMS, 2019–2024) → train MW-AeroFusion-Net → evaluate vs CAMS/persistence → serve forecasts + SHAP/attention

## Known issues / notes
- Live PM2.5 is the **CAMS model** (~40 km), not ground truth; CPCB archive (XKDR) is not real-time (PM2.5 to Mar 2026, most stations to Dec 2024).
- If `maplibre-gl` is upgraded, re-copy `node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs` → `frontend/public/maplibre/` (maps go blank otherwise).
- CARTO raster tiles now require a key → Esri tiles are used for labels / dark / light.
- Backend runs without `--reload`: restart the API after backend edits.
- Browsers block autoplay audio until the first click / keypress.
- Christmas Mallow is a personal-use demo font; Papernotes licence unverified — clear licences before public use.
- In-app preview screenshots stall on animated pages; use `?static=1`.

## Run locally
See [README.md](README.md#run-locally).
