"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/primitives";
import { API_URL, useLive, type LiveSnapshot } from "@/hooks/use-live";
import { cn } from "@/lib/utils";

/** Renders children with the live snapshot, or a clear offline / loading state. */
export function LiveGate({ children, skeleton = "h-[480px]" }: { children: (snap: LiveSnapshot) => ReactNode; skeleton?: string }) {
  const { snap, error, reload } = useLive();
  if (snap) return <>{children(snap)}</>;
  if (error)
    return (
      <Card>
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-300" />
          <div className="text-sm text-fg">
            <b>Connecting to the live data server…</b> The free server sleeps when nobody is using it and takes about a minute to wake up. This page connects automatically.
            {API_URL.includes("localhost") && (
              <pre className="mt-2 overflow-x-auto rounded-xl bg-black/40 p-3 font-mono text-xs text-emerald-200">python -m uvicorn app.main:app --app-dir backend --port 8000</pre>
            )}
            <div className="mt-2 flex items-center gap-3 text-xs text-fg-muted">
              {API_URL} · {error}
              <button onClick={reload} className="inline-flex items-center gap-1 rounded-full bg-surface-sunken px-3 py-1 font-semibold text-fg">
                <RefreshCw className="size-3" /> Retry
              </button>
            </div>
          </div>
        </div>
      </Card>
    );
  return <Skeleton className={cn("w-full !rounded-[28px]", skeleton)} />;
}

export function SourceNote({ children }: { children: ReactNode }) {
  return <div className="mt-4 rounded-2xl bg-surface-sunken px-4 py-3 text-xs leading-relaxed text-fg-muted">{children}</div>;
}
