"use client";

import {
  Bot,
  BrainCircuit,
  Check,
  ChevronDown,
  Cpu,
  Loader2,
  Send,
  Sparkles,
  User,
} from "lucide-react";
import { Popover } from "radix-ui";
import { AnimatePresence, motion } from "motion/react";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/primitives";
import { Tilt } from "@/components/ui/tilt";
import { API_URL, useApi, type LiveSnapshot } from "@/hooks/use-live";
import { fmtIst } from "@/lib/live";
import { cn } from "@/lib/utils";

interface Insight {
  title: string;
  finding: string;
  reasoning: string;
  tone: "alert" | "warn" | "good" | "info";
  cities?: string[];
  confidence?: string;
}

interface InsightsResp {
  headline: string;
  insights: Insight[];
  updated_at: string | null;
  model: string | null;
  generating?: boolean;
  generating_for_s?: number;
  error?: string | null;
  stale?: boolean;
}

const TONE: Record<Insight["tone"], string> = {
  alert: "#ef4444",
  warn: "#f59e0b",
  good: "#10b981",
  info: "#38bdf8",
};

/** Minimal Markdown: paragraphs, bullets, **bold**. */
function Md({ text }: { text: string }) {
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
      p.startsWith("**") && p.endsWith("**") ? (
        <b key={i} className="text-fg">
          {p.slice(2, -2)}
        </b>
      ) : (
        <Fragment key={i}>{p}</Fragment>
      ),
    );
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length)
      blocks.push(
        <ul key={blocks.length} className="ml-4 list-disc space-y-0.5">
          {list.map((l, i) => (
            <li key={i}>{inline(l)}</li>
          ))}
        </ul>,
      );
    list = [];
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (/^[-*•]\s+/.test(line)) list.push(line.replace(/^[-*•]\s+/, ""));
    else {
      flush();
      if (line)
        blocks.push(
          <p key={blocks.length}>{inline(line.replace(/^#+\s*/, ""))}</p>,
        );
    }
  }
  flush();
  return <div className="space-y-1.5">{blocks}</div>;
}

export function AiInsights({
  snap,
  nonce = 0,
  provider = "auto",
}: {
  snap: LiveSnapshot;
  nonce?: number;
  provider?: string;
}) {
  const [d, setD] = useState<InsightsResp | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const forced = useRef(-1);

  // fetch now; keep polling every 8 s while the server is still generating
  useEffect(() => {
    let alive = true;
    const force = nonce > 0 && forced.current !== nonce;
    if (force) forced.current = nonce;
    fetch(
      `${API_URL}/api/ai/insights?provider=${provider}${force ? "&force=1" : ""}`,
    )
      .then(async (r) =>
        r.ok
          ? r.json()
          : Promise.reject(
              new Error(
                (await r.json().catch(() => ({}))).detail ?? `HTTP ${r.status}`,
              ),
            ),
      )
      .then((j: InsightsResp) => {
        if (!alive) return;
        setD(j);
        setError(j.error && !j.insights.length ? j.error : null);
      })
      .catch((e) => alive && setError(String(e.message ?? e)));
    return () => {
      alive = false;
    };
  }, [snap.updated_at, nonce, tick, provider]);

  const generating = !!d?.generating;
  useEffect(() => {
    if (!generating) return;
    const id = setTimeout(() => setTick((t) => t + 1), 8000);
    return () => clearTimeout(id);
  }, [generating, tick]);

  const has = !!d && d.insights.length > 0;
  const loading = !d && !error;

  return (
    <Card>
      <CardHeader
        title="AI analyst · live insights"
        subtitle={
          has && d.updated_at
            ? `Reasoned from the ${fmtIst(Date.parse(d.updated_at), { hour: "numeric", minute: "2-digit", hour12: true })} IST snapshot · ${d.model}`
            : generating
              ? `Writing insights from the live data… ${d?.generating_for_s ?? 0}s (a self-hosted CPU model can take a few minutes)`
              : "Reading the current live data…"
        }
        icon={<BrainCircuit className="size-4" />}
        action={
          generating || loading ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/90">
              <Loader2 className="size-3.5 animate-spin" />{" "}
              {has ? "updating…" : "generating…"}
            </span>
          ) : undefined
        }
      />
      {error && !has ? (
        <div className="rounded-2xl bg-amber-500/12 p-3 text-sm text-amber-200">
          AI insights unavailable: {error}
        </div>
      ) : !has ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-40 !rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="ai-card glass-hero mb-4 flex items-start gap-2.5 rounded-[24px] p-4 text-[16px] font-medium leading-relaxed text-white">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
            {d.headline}
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {d.insights.map((ins, i) => (
              <InsightCard key={ins.title + i} ins={ins} i={i} />
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

function InsightCard({ ins, i }: { ins: Insight; i: number }) {
  const [open, setOpen] = useState(false);
  const color = TONE[ins.tone] ?? TONE.info;
  return (
    <Tilt rotateAmplitude={6} scaleOnHover={1.02} radius="24px">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.06 }}
        className="ai-card h-full glass-hero relative overflow-hidden rounded-[24px] p-5"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 text-[17px] font-semibold leading-snug text-white">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ background: color, boxShadow: `0 0 8px ${color}` }}
            />
            {ins.title}
          </div>
          {ins.confidence && (
            <Badge className="shrink-0">{ins.confidence}</Badge>
          )}
        </div>
        <p className="mt-2 text-[15px] leading-relaxed text-white/90">
          {ins.finding}
        </p>
        {!!ins.cities?.length && (
          <div className="mt-2 flex flex-wrap gap-1">
            {ins.cities.slice(0, 5).map((c) => (
              <span
                key={c}
                className="rounded-full bg-white/12 px-2.5 py-0.5 text-[12px] font-medium text-white shadow-[inset_0_0_0_0.75px_rgba(255,255,255,0.25)]"
              >
                {c}
              </span>
            ))}
          </div>
        )}
        <button
          onClick={() => setOpen((o) => !o)}
          className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-teal-200"
        >
          Reasoning{" "}
          <ChevronDown
            className={cn(
              "size-3.5 transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.p
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden text-[14px] leading-relaxed text-white/85"
            >
              <span className="mt-2 block rounded-xl bg-white/8 px-3 py-2">
                {ins.reasoning}
              </span>
            </motion.p>
          )}
        </AnimatePresence>
      </motion.div>
    </Tilt>
  );
}

const SUGGESTIONS = [
  "Why is the most polluted city so bad today?",
  "Which cities will get worse in the next 24 hours?",
  "Are crop fires affecting Delhi right now?",
  "Is it safe to go jogging in Bengaluru this evening?",
];

const MARK = "\u001e";

export function AiChat({
  city,
  provider = "auto",
}: {
  city: string;
  provider?: string;
}) {
  const [msgs, setMsgs] = useState<
    { role: "user" | "assistant"; content: string; model?: string }[]
  >([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [msgs, busy]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    const next = [...msgs, { role: "user" as const, content: q }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    try {
      const r = await fetch(`${API_URL}/api/ai/chat/stream`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: next.map(({ role, content }) => ({ role, content })),
          city,
          provider,
        }),
      });
      if (!r.ok || !r.body) throw new Error((await r.json().catch(() => ({}))).detail ?? `HTTP ${r.status}`);
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let raw = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        raw += dec.decode(value, { stream: true });
        // stream begins with \u001e<model label>\u001e
        let model: string | undefined;
        let answer = raw;
        if (raw.startsWith(MARK)) {
          const end = raw.indexOf(MARK, 1);
          if (end < 0) continue;
          model = raw.slice(1, end);
          answer = raw.slice(end + 1);
        }
        setMsgs([...next, { role: "assistant", content: answer, model }]);
      }
      if (!raw.replace(/\u001e[^\u001e]*\u001e/, "").trim())
        setMsgs([
          ...next,
          { role: "assistant", content: "⚠️ Empty answer from the model." },
        ]);
    } catch (e) {
      setMsgs([...next, { role: "assistant", content: `⚠️ ${e instanceof Error ? e.message : String(e)}` }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="flex h-[560px] flex-col">
      <CardHeader
        title="Ask the data"
        subtitle={`Chat grounded in the current live snapshot · selected: ${city}`}
        icon={<Bot className="size-4" />}
      />
      <div
        className="-mx-1 flex-1 space-y-3 overflow-y-auto px-1 scrollbar-thin"
        data-lenis-prevent
      >
        {msgs.length === 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="rounded-2xl bg-surface-sunken p-3 text-left text-[13px] text-fg-muted transition hover:text-fg"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {msgs.map((m, i) => (
          <div
            key={i}
            className={cn(
              "flex gap-2.5",
              m.role === "user" && "flex-row-reverse",
            )}
          >
            <span
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-full",
                m.role === "user"
                  ? "bg-white/20"
                  : "bg-primary-soft text-primary",
              )}
            >
              {m.role === "user" ? (
                <User className="size-3.5" />
              ) : (
                <Bot className="size-3.5" />
              )}
            </span>
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed",
                m.role === "user"
                  ? "bg-white/90 text-slate-900"
                  : "bg-surface-sunken text-fg-muted",
              )}
            >
              {m.role === "user" ? m.content : <Md text={m.content} />}
              {m.model && (
                <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10.5px] font-medium text-white/75">
                  <Cpu className="size-3" /> {m.model}
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && msgs[msgs.length - 1]?.role === "user" && (
          <div className="flex items-center gap-2 text-xs text-fg-muted">
            <Loader2 className="size-3.5 animate-spin" /> Reasoning over live
            data…
          </div>
        )}
        <div ref={end} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="mt-3 flex items-center gap-2 rounded-full bg-surface-sunken p-1.5 pl-4"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything about today's air quality…"
          className="h-9 flex-1 bg-transparent text-sm text-fg outline-none placeholder:text-fg-subtle"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="grid size-9 place-items-center rounded-full bg-primary text-white disabled:opacity-40"
          aria-label="Send"
        >
          <Send className="size-4" />
        </button>
      </form>
    </Card>
  );
}

interface ProviderOption {
  id: string;
  label: string;
  detail: string;
  available: boolean;
}

/** Glass dropdown to pick which LLM writes the insights and answers the chat. */
export function ModelPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { data } = useApi<{ options: ProviderOption[] }>("/api/ai/provider");
  const [open, setOpen] = useState(false);
  const opts = data?.options ?? [
    { id: "auto", label: "Auto", detail: "Bedrock → Groq", available: true },
  ];
  const cur = opts.find((o) => o.id === value) ?? opts[0];
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button className="glass group inline-flex h-14 min-w-[250px] items-center gap-3 rounded-full px-5 text-left transition hover:brightness-110">
          <BrainCircuit className="size-5 shrink-0 text-primary" />
          <span className="min-w-0 flex-1">
            <span className="block text-[10.5px] font-semibold uppercase tracking-wider text-fg-subtle">
              AI model
            </span>
            <span className="block truncate text-[15px] font-semibold text-fg">
              {cur.label}
            </span>
          </span>
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-fg-subtle transition-transform",
              open && "rotate-180",
            )}
          />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={8}
          className="glass-pop z-[90] w-[320px] rounded-[24px] p-1.5 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          {opts.map((o) => (
            <button
              key={o.id}
              disabled={!o.available}
              onClick={() => {
                onChange(o.id);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition hover:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-40",
                o.id === value && "bg-surface-sunken",
              )}
            >
              <Check
                className={cn(
                  "size-4 shrink-0 text-primary",
                  o.id === value ? "opacity-100" : "opacity-0",
                )}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-fg">
                  {o.label}
                </span>
                <span className="block truncate text-[11.5px] text-fg-muted">
                  {o.available ? o.detail : `${o.detail} · not configured`}
                </span>
              </span>
            </button>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
