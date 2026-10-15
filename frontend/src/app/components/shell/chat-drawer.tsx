import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ArrowUp, Square, X } from "lucide-react";
import { Ember } from "@/components/brand/ember";
import { Figure } from "@/components/figure";
import { ArrowUpRightMark, Button } from "@/components/ui/button";
import { PulsatingLoader } from "@/components/ui/loader";
import { Select } from "@/components/ui/select";
import { API_URL, useApi } from "@/lib/api";
import { CITY_BY_SLUG } from "@/lib/cities";
import { usePrefs } from "@/lib/prefs";
import { sound } from "@/lib/sound";
import { cn } from "@/lib/utils";

const MARK = "\u001e";

interface Msg {
  role: "user" | "assistant";
  content: string;
  model?: string;
  error?: boolean;
}

export interface ProviderOption {
  id: string;
  label: string;
  detail: string;
  available: boolean;
}

/** Minimal Markdown for answers: paragraphs, bullets, **bold**. */
export function Md({ text }: { text: string }) {
  const inline = (s: string) =>
    s.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
      p.startsWith("**") && p.endsWith("**") ? (
        <strong key={i} className="font-semibold text-ink">
          {p.slice(2, -2)}
        </strong>
      ) : (
        <Fragment key={i}>{p}</Fragment>
      ),
    );
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length)
      blocks.push(
        <ul key={blocks.length} className="ml-4 list-disc space-y-1 marker:text-ink-3">
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
      if (line) blocks.push(<p key={blocks.length}>{inline(line.replace(/^#+\s*/, ""))}</p>);
    }
  }
  flush();
  return <div className="space-y-2">{blocks}</div>;
}

/** Which model writes: Auto (Bedrock, then Groq), or one of them. */
export function ModelPicker({ className }: { className?: string }) {
  const { provider, setProvider } = usePrefs();
  const { data } = useApi<{ options: ProviderOption[] }>("/api/ai/provider");
  const opts = data?.options ?? [{ id: "auto", label: "Auto", detail: "Bedrock, then Groq", available: true }];
  return (
    <Select
      label="AI model"
      value={provider}
      onValueChange={setProvider}
      options={opts.filter((o) => o.available).map((o) => ({ value: o.id, label: o.label, hint: o.id === "auto" ? "fallback" : undefined }))}
      prefix={<span className="text-ink-2">Model</span>}
      triggerClassName={className}
    />
  );
}

const SUGGEST = (city: string) => [`Why is ${city}'s air like this today?`, `When is the best time to go outside in ${city}?`, "Which cities are worst right now, and why?", "How much are fires contributing?"];

/**
 * Ask the data: a chat grounded in the live snapshot, streamed. It opens from any view as a side
 * sheet that doesn't block the page (Apple › materials: separate to keep flow — glass, no scrim),
 * from the right on desktop and from the bottom on a phone, and leaves the way it came.
 */
export function ChatDrawer({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { city, provider } = usePrefs();
  const cityName = CITY_BY_SLUG[city]?.name ?? "Delhi";
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [msgs]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    sound.tick();
    const next: Msg[] = [...msgs, { role: "user", content: q }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    const ctl = new AbortController();
    abort.current = ctl;
    try {
      const r = await fetch(`${API_URL}/api/ai/chat/stream`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next.map(({ role, content }) => ({ role, content })), city, provider }),
        signal: ctl.signal,
      });
      if (r.status === 429) throw new Error("Too many questions in a short time. Wait a minute and ask again.");
      if (!r.ok || !r.body) throw new Error((await r.json().catch(() => ({}))).detail ?? `The AI service answered ${r.status}.`);
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let raw = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        raw += dec.decode(value, { stream: true });
        let model: string | undefined;
        let answer = raw;
        if (raw.startsWith(MARK)) {
          const close = raw.indexOf(MARK, 1);
          if (close < 0) continue;
          model = raw.slice(1, close);
          answer = raw.slice(close + 1);
        }
        setMsgs([...next, { role: "assistant", content: answer, model }]);
      }
      if (!raw.replace(/\u001e[^\u001e]*\u001e/, "").trim()) setMsgs([...next, { role: "assistant", content: "The model returned an empty answer. Try asking again, or pick another model.", error: true }]);
      else sound.chime();
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setMsgs([...next, { role: "assistant", content: e instanceof Error ? e.message : String(e), error: true }]);
    } finally {
      setBusy(false);
      abort.current = null;
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} modal={false}>
      <Dialog.Portal>
        <Dialog.Content
          onInteractOutside={(e) => e.preventDefault()}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            field.current?.focus();
          }}
          className={cn(
            "glass fixed z-[65] flex flex-col overflow-hidden",
            "inset-x-0 bottom-0 top-[14dvh] bg-surface data-[state=open]:animate-[sheet-up_600ms_var(--ease-out)]",
            "sm:inset-x-auto sm:bottom-0 sm:right-0 sm:top-0 sm:w-[460px] sm:data-[state=open]:animate-[sheet-in_600ms_var(--ease-out)]",
          )}
        >
          <div className="flex items-start gap-3 border-b border-line px-6 pb-5 pt-6">
            <div className="min-w-0">
              <div className="tag mb-3 flex items-center gap-2.5">
                <Ember size={14} />
                Agent · live snapshot
              </div>
              <Dialog.Title className="text-[26px] font-light leading-none tracking-[-0.04em]">
                Ask the <strong className="font-bold">data.</strong>
              </Dialog.Title>
              <Dialog.Description className="mt-2 truncate text-[12.5px] text-ink-2">Answers use the live snapshot · {cityName} selected</Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <Button size="icon-sm" variant="ghost" className="ml-auto" aria-label="Close">
                <X />
              </Button>
            </Dialog.Close>
          </div>
          <div className="px-6 pt-4">
            <ModelPicker className="h-8 text-[13px]" />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5" aria-live="polite">
            {msgs.length === 0 ? (
              <div className="grid justify-items-center gap-4 pt-2 text-center">
                <Figure name="query" label="A question mark turning toward the pointer" intensity={0.6} className="w-full max-w-[220px]" />
                <p className="max-w-xs text-[13.5px] leading-relaxed text-ink-2">Ask anything about the air right now. Answers come only from today's fused data, and the model can still be wrong.</p>
                <ol className="grid w-full border-t border-line text-left">
                  {SUGGEST(cityName).map((s, i) => (
                    <li key={s} className="border-b border-line">
                      <button type="button" onClick={() => send(s)} className="group flex w-full items-center gap-4 transition-colors py-3.5 text-left text-[13.5px] text-ink-2 hover:text-ink">
                        <span className="font-mono text-[10.5px] tracking-[0.12em] text-ink-3">{String(i + 1).padStart(2, "0")}</span>
                        <span className="min-w-0 flex-1">{s}</span>
                        <ArrowUpRightMark />
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
            ) : (
              <ol className="grid gap-4">
                {msgs.map((m, i) => (
                  <li key={i} className={cn("max-w-[92%] text-[14px] leading-relaxed", m.role === "user" ? "justify-self-end bg-ink px-4 py-2.5 text-canvas" : "text-ink-2")}>
                    {m.role === "assistant" ? (
                      <>
                        {m.model && <div className="tag mb-1.5 normal-case">{m.model}</div>}
                        <div className={cn(m.error && "text-bad")}>
                          <Md text={m.content} />
                        </div>
                      </>
                    ) : (
                      m.content
                    )}
                  </li>
                ))}
                {busy && msgs[msgs.length - 1]?.role === "user" && (
                  <li>
                    <PulsatingLoader label="Reading the snapshot" />
                  </li>
                )}
              </ol>
            )}
            <div ref={end} />
          </div>

          <form
            className="flex items-end gap-2 border-t border-line p-4"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <label htmlFor="ask" className="sr-only">
              Your question
            </label>
            <textarea
              id="ask"
              ref={field}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder={`Ask about ${cityName}, fires, the forecast…`}
              className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-4 py-2 text-[15px] text-ink outline-none shadow-[inset_0_0_0_1px_var(--line-2)] transition-shadow placeholder:text-ink-3 focus:shadow-[inset_0_0_0_1px_var(--ink)]"
            />
            {busy ? (
              <Button size="icon" variant="tinted" aria-label="Stop" onClick={() => abort.current?.abort()}>
                <Square className="fill-current" />
              </Button>
            ) : (
              <Button size="icon" variant="primary" type="submit" aria-label="Send" disabled={!input.trim()}>
                <ArrowUp />
              </Button>
            )}
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
