"""LLM reasoning over the live snapshot (Groq, OpenAI-compatible API).

The model only sees numbers computed by the backend from the live sources, and is told to
reason from them and say when the data can't answer something.
"""

from __future__ import annotations

import asyncio
import json
import math
import os

import httpx

GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

SYSTEM = """You are AeroFusion's air-quality analyst for India. You reason ONLY from the live data context provided
(CAMS modelled PM2.5 via Open-Meteo, Open-Meteo weather, NASA FIRMS fires, CPCB measured baselines via XKDR).
Rules: use the 'category' column exactly as given; cite concrete numbers and city names from the context; explain the physical reasoning (dispersion, mixing height,
wind transport, fires, humidity, seasonality); never invent values; if the context can't answer, say so plainly.
PM2.5 categories (µg/m³, 24-h): Good ≤30, Satisfactory ≤60, Moderate ≤90, Poor ≤120, Very poor ≤250, Severe >250. NAAQS 24-h = 60.
Live PM2.5 is a model estimate (CAMS), not a ground measurement; the AeroFusion model itself is not trained yet."""


def _r(v, d=1):
    return None if v is None or (isinstance(v, float) and math.isnan(v)) else round(v, d)


def _spearman(xs, ys):
    pairs = [(x, y) for x, y in zip(xs, ys) if x is not None and y is not None]
    if len(pairs) < 5:
        return None

    def rank(a):
        order = sorted(range(len(a)), key=lambda i: a[i])
        r = [0.0] * len(a)
        for k, i in enumerate(order):
            r[i] = k + 1
        return r

    rx, ry = rank([p[0] for p in pairs]), rank([p[1] for p in pairs])
    n = len(pairs)
    m = (n + 1) / 2
    num = sum((a - m) * (b - m) for a, b in zip(rx, ry))
    den = math.sqrt(sum((a - m) ** 2 for a in rx) * sum((b - m) ** 2 for b in ry))
    return round(num / den, 2) if den else None


def _cat(pm: float) -> str:
    for lim, name in ((30, "Good"), (60, "Satisfactory"), (90, "Moderate"), (120, "Poor"), (250, "Very poor")):
        if pm <= lim:
            return name
    return "Severe"


def build_context(snap: dict) -> str:
    cities = [c for c in snap["cities"] if c.get("pm25") is not None]
    rows = []
    for c in sorted(cities, key=lambda c: -c["pm25"]):
        s = c.get("series") or {}
        pm = s.get("pm25") or []
        times = s.get("time") or []
        # next-24h peak from the hourly series (series starts 48 h in the past)
        fut = [(t, v) for t, v in zip(times[48:72], pm[48:72]) if v is not None]
        peak = max(fut, key=lambda x: x[1]) if fut else (None, None)
        past = [v for v in c.get("pm25_24h") or [] if v is not None]
        pt = None
        if peak[0]:
            h = (int(peak[0][11:13]) + 5) % 24 + (1 if int(peak[0][14:16]) + 30 >= 60 else 0)
            pt = f"{h % 24:02d}:{(int(peak[0][14:16]) + 30) % 60:02d} IST"
        rows.append(
            [c["name"], _cat(c["pm25"]), _r(c["pm25"], 0), _r(past[0], 0) if past else None, _r(peak[1], 0), pt, _r(c.get("pm10"), 0), _r(c.get("aod"), 2),
             _r(c.get("dust"), 0), _r(c.get("no2"), 0), _r(c.get("temp"), 0), _r(c.get("rh"), 0), _r(c.get("wind")), _r(c.get("wind_dir"), 0),
             _r(c.get("pblh"), 0), c.get("fires_300km"), c.get("fires_upwind"), _r((c.get("cpcb") or {}).get("pm25_mean"), 0)]
        )
    feats = ["aod", "dust", "no2", "co", "temp", "rh", "wind", "pblh", "fires_300km", "fires_upwind", "cpcb_baseline"]
    corr = {f: _spearman([c["pm25"] for c in cities], [c.get(f) for c in cities]) for f in feats}
    nat = sum(c["pm25"] for c in cities) / len(cities)
    ctx = {
        "updated_at_utc": snap["updated_at"],
        "national_avg_pm25": round(nat, 1),
        "cities_above_naaqs": sum(c["pm25"] > 60 for c in cities),
        "fires_24h_total": snap["fires"]["total"],
        "fire_regions": snap["fires"]["regions"][:6],
        "spearman_pm25_vs_feature_across_cities": corr,
        "sources_online": [s["name"] for s in snap["sources"] if s["ok"]],
        "city_columns": ["city", "category", "pm25", "pm25_24h_ago", "next24h_peak", "peak_time", "pm10", "aod", "dust", "no2", "temp_c", "rh", "wind_ms",
                         "wind_from_deg", "pblh_m", "fires_300km", "fires_upwind", "cpcb_same_month_2024"],
        "cities": rows,
    }
    return json.dumps(ctx, separators=(",", ":"))


def provider_info() -> dict:
    """Ordered LLM chain, e.g. AI_PROVIDERS=bedrock,groq — the first that answers wins."""
    chain = [p.strip().lower() for p in os.getenv("AI_PROVIDERS", "bedrock,groq").split(",") if p.strip()]
    return {
        "chain": chain,
        "provider": chain[0] if chain else "none",
        "bedrock_region": os.getenv("BEDROCK_REGION", "us-east-1"),
        "bedrock_model": os.getenv("BEDROCK_MODEL", "us.amazon.nova-micro-v1:0"),
        "bedrock": bool(os.getenv("AWS_BEARER_TOKEN_BEDROCK")),
        "ollama_url": os.getenv("OLLAMA_URL", "http://localhost:11434").rstrip("/"),
        "ollama_model": os.getenv("OLLAMA_MODEL", "qwen2.5:3b"),
        "ollama_chat_model": os.getenv("OLLAMA_CHAT_MODEL") or os.getenv("OLLAMA_MODEL", "qwen2.5:3b"),
        "groq": bool(os.getenv("GROQ_API_KEY")),
    }


async def _bedrock(messages: list[dict], json_mode: bool, max_tokens: int, chat: bool) -> tuple[str, str]:
    """Amazon Bedrock Converse API with a Bedrock API key (bearer token)."""
    key = os.getenv("AWS_BEARER_TOKEN_BEDROCK")
    if not key:
        raise RuntimeError("AWS_BEARER_TOKEN_BEDROCK not configured")
    cfg = provider_info()
    model = cfg["bedrock_model"]
    system = [{"text": m["content"]} for m in messages if m["role"] == "system"]
    convo = [{"role": m["role"], "content": [{"text": m["content"]}]} for m in messages if m["role"] in ("user", "assistant")]
    if json_mode:
        system.append({"text": "Respond with a single valid JSON object only. No prose, no code fences."})
    body = {"messages": convo, "system": system, "inferenceConfig": {"maxTokens": min(max_tokens, 5000), "temperature": 0.3}}
    url = f"https://bedrock-runtime.{cfg['bedrock_region']}.amazonaws.com/model/{model}/converse"
    async with httpx.AsyncClient(timeout=90) as client:
        for attempt in range(2):
            r = await client.post(url, headers={"Authorization": f"Bearer {key}"}, json=body)
            if r.status_code not in (429, 503) or attempt:
                break
            await asyncio.sleep(3)
    if r.status_code != 200:
        raise RuntimeError(f"Bedrock {r.status_code}: {r.text[:200]}")
    parts = r.json()["output"]["message"]["content"]
    return "".join(p.get("text", "") for p in parts), f"Amazon {model.split('.', 1)[-1].replace('amazon.', '').replace('-v1:0', '').replace('-', ' ').title()} on Bedrock"


async def _ollama(messages: list[dict], json_mode: bool, max_tokens: int, chat: bool) -> tuple[str, str]:
    cfg = provider_info()
    model = cfg["ollama_chat_model"] if chat else cfg["ollama_model"]
    headers = {}
    if os.getenv("OLLAMA_API_KEY"):  # bearer token checked by the reverse proxy in deploy/ollama
        headers["Authorization"] = f"Bearer {os.getenv('OLLAMA_API_KEY')}"
    body = {
        "model": model,
        "messages": messages,
        "stream": False,
        "keep_alive": "30m",
        "options": {"temperature": 0.3, "num_predict": max_tokens, "num_ctx": int(os.getenv("OLLAMA_NUM_CTX", "8192"))},
    }
    if json_mode:
        body["format"] = "json"
    async with httpx.AsyncClient(timeout=float(os.getenv("OLLAMA_TIMEOUT", "300"))) as client:
        r = await client.post(f"{cfg['ollama_url']}/api/chat", headers=headers, json=body)
    if r.status_code != 200:
        raise RuntimeError(f"Ollama {r.status_code}: {r.text[:200]}")
    return r.json()["message"]["content"], f"{model} on Ollama"


async def _groq(messages: list[dict], json_mode: bool, max_tokens: int, chat: bool) -> tuple[str, str]:
    key = os.getenv("GROQ_API_KEY")
    if not key:
        raise RuntimeError("GROQ_API_KEY not configured")
    model = os.getenv("GROQ_CHAT_MODEL", "openai/gpt-oss-20b") if chat else os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
    # gpt-oss models spend part of the budget on hidden reasoning — give structured output more room
    body = {"model": model, "messages": messages, "temperature": 0.3, "max_tokens": max(max_tokens * 2, 4000) if json_mode else max_tokens}
    if json_mode:
        body["response_format"] = {"type": "json_object"}
    async with httpx.AsyncClient(timeout=60) as client:
        for attempt in range(2):
            r = await client.post(GROQ_URL, headers={"Authorization": f"Bearer {key}"}, json=body)
            if r.status_code != 429 or attempt:
                break
            await asyncio.sleep(min(20.0, float(r.headers.get("retry-after", "8"))))
    if r.status_code != 200:
        raise RuntimeError(f"Groq {r.status_code}: {r.text[:200]}")
    return r.json()["choices"][0]["message"]["content"], f"{model} on Groq"


_PROVIDERS = {}


def options() -> list[dict]:
    """Models the UI can pick from (no secrets)."""
    cfg = provider_info()
    groq_model = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b").split("/")[-1].upper().replace("GPT-OSS-", "GPT-OSS ")
    opts = [
        {"id": "auto", "label": "Auto", "detail": " → ".join(cfg["chain"]) + " (fallback)", "available": True},
        {"id": "bedrock", "label": "Amazon Nova Micro", "detail": f"Amazon Bedrock · {cfg['bedrock_region']}", "available": cfg["bedrock"]},
        {"id": "groq", "label": "GPT-OSS on Groq", "detail": f"{groq_model} cards · {os.getenv('GROQ_CHAT_MODEL', 'openai/gpt-oss-20b').split('/')[-1].upper().replace('GPT-OSS-', 'GPT-OSS ')} chat · free tier", "available": cfg["groq"]},
    ]
    if os.getenv("OLLAMA_URL"):
        opts.append({"id": "ollama", "label": cfg["ollama_model"], "detail": "Ollama · self-hosted", "available": True})
    return opts


def resolve_chain(choice: str | None) -> list[str]:
    if not choice or choice == "auto":
        return provider_info()["chain"]
    if choice not in _PROVIDERS:
        raise ValueError(f"unknown provider '{choice}'")
    return [choice]


async def _complete(messages: list[dict], json_mode: bool = False, max_tokens: int = 1800, chat: bool = False, chain: list[str] | None = None) -> tuple[str, str]:
    errors = []
    for name in chain or provider_info()["chain"]:
        fn = _PROVIDERS.get(name)
        if not fn:
            continue
        try:
            text, label = await fn(messages, json_mode, max_tokens, chat)
            if not text.strip():
                raise RuntimeError("empty response")
            return text, label
        except Exception as e:  # noqa: BLE001
            errors.append(f"{name}: {e}")
            print(f"[ai] {name} failed ({e}); trying next provider")
    raise RuntimeError("All AI providers failed — " + " | ".join(errors) if errors else "No AI provider configured")


def _parse_json(text: str) -> dict:
    """Small local models sometimes wrap JSON in prose or code fences."""
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        a, b = text.find("{"), text.rfind("}")
        if a >= 0 and b > a:
            return json.loads(text[a : b + 1])
        raise


def _clean(data: dict) -> dict:
    tones = {"alert", "warn", "good", "info"}
    out = []
    for ins in data.get("insights") or []:
        if not isinstance(ins, dict) or not ins.get("title"):
            continue
        cities = ins.get("cities") or []
        out.append(
            {
                "title": str(ins["title"]),
                "finding": str(ins.get("finding", "")),
                "reasoning": str(ins.get("reasoning", "")),
                "tone": ins.get("tone") if ins.get("tone") in tones else "info",
                "cities": [str(c) for c in cities] if isinstance(cities, list) else [str(cities)],
                "confidence": str(ins.get("confidence", "medium")).lower(),
            }
        )
    return {"headline": str(data.get("headline", "")), "insights": out[:6]}


async def insights(snap: dict, chain: list[str] | None = None) -> dict:
    prompt = (
        "LIVE DATA CONTEXT (JSON):\n"
        + build_context(snap)
        + """

Write 6 concise insight cards about India's air quality right now (each field 1-2 short sentences). Return JSON:
{"headline": "<one sentence national summary>",
 "insights": [{"title": "<short>", "finding": "<what the data shows, with numbers>",
   "reasoning": "<why, physically, step by step in 2-3 sentences, referencing the drivers>",
   "tone": "alert|warn|good|info", "cities": ["<city names>"], "confidence": "high|medium|low"}]}
Cover: the worst hotspots and their causes, the next-24h outlook, the fire/transport signal, meteorology (wind/mixing height),
the cross-city driver correlations, and how today compares with the CPCB 2024 same-month baseline."""
    )
    out, label = await _complete([{"role": "system", "content": SYSTEM}, {"role": "user", "content": prompt}], json_mode=True, max_tokens=int(os.getenv("AI_INSIGHT_TOKENS", "1500")), chain=chain)
    data = _clean(_parse_json(out))
    if not data["insights"]:
        raise RuntimeError(f"{label} returned no usable insights")
    data["updated_at"] = snap["updated_at"]
    data["model"] = label
    return data


async def chat(snap: dict, messages: list[dict], city: str | None) -> str:
    msgs = _chat_messages(snap, messages, city)
    text, _ = await _complete(msgs, max_tokens=1200, chat=True)
    return text


def _chat_messages(snap: dict, messages: list[dict], city: str | None) -> list[dict]:
    sys_msg = SYSTEM + "\n\nLIVE DATA CONTEXT (JSON):\n" + build_context(snap)
    if city:
        sys_msg += f"\nThe user currently has '{city}' selected."
    sys_msg += "\nAnswer concisely in Markdown (short paragraphs or bullets)."
    return [{"role": "system", "content": sys_msg}] + [
        {"role": m["role"], "content": str(m["content"])[:2000]} for m in messages[-10:] if m.get("role") in ("user", "assistant")
    ]


MODEL_MARK = "\x1e"  # stream starts with  \x1e<model label>\x1e  so the UI can show who answered


async def chat_stream(snap: dict, messages: list[dict], city: str | None, chain: list[str] | None = None):
    """Yield answer text. Ollama streams token by token; Bedrock / Groq answer in one fast chunk."""
    msgs = _chat_messages(snap, messages, city)
    cfg = provider_info()
    errors = []
    for name in chain or cfg["chain"]:
        if name == "ollama":
            headers = {"Authorization": f"Bearer {os.getenv('OLLAMA_API_KEY')}"} if os.getenv("OLLAMA_API_KEY") else {}
            body = {
                "model": cfg["ollama_chat_model"],
                "messages": msgs,
                "stream": True,
                "keep_alive": "30m",
                "options": {"temperature": 0.3, "num_predict": 700, "num_ctx": int(os.getenv("OLLAMA_NUM_CTX", "8192"))},
            }
            sent = False
            try:
                async with httpx.AsyncClient(timeout=httpx.Timeout(float(os.getenv("OLLAMA_TIMEOUT", "300")), connect=10)) as client:
                    async with client.stream("POST", f"{cfg['ollama_url']}/api/chat", headers=headers, json=body) as r:
                        if r.status_code != 200:
                            raise RuntimeError(f"Ollama {r.status_code}")
                        async for line in r.aiter_lines():
                            if not line.strip():
                                continue
                            part = json.loads(line)
                            chunk = (part.get("message") or {}).get("content", "")
                            if chunk:
                                if not sent:
                                    yield f"{MODEL_MARK}{cfg['ollama_chat_model']} on Ollama{MODEL_MARK}"
                                sent = True
                                yield chunk
                            if part.get("done"):
                                return
                return
            except Exception as e:  # noqa: BLE001
                if sent:
                    yield f"\n\n⚠️ stream interrupted: {e}"
                    return
                errors.append(f"ollama: {e}")
                continue
        fn = _PROVIDERS.get(name)
        if not fn:
            continue
        try:
            text, label = await fn(msgs, False, 1200, True)
            if not text.strip():
                raise RuntimeError("empty response")
            yield f"{MODEL_MARK}{label}{MODEL_MARK}"
            yield text
            return
        except Exception as e:  # noqa: BLE001
            errors.append(f"{name}: {e}")
            print(f"[ai] {name} chat failed ({e}); trying next provider")
    yield "⚠️ All AI providers failed — " + " | ".join(errors)

_PROVIDERS.update({"bedrock": _bedrock, "groq": _groq, "ollama": _ollama})
