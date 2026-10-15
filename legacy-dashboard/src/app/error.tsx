"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-[#0b1430] p-6 text-white">
      <div className="glass-hero max-w-md rounded-[28px] p-8 text-center">
        <div className="font-display text-2xl">Live data is catching up</div>
        <p className="mt-2 text-sm text-white/75">One of the data sources didn&apos;t answer in time. The server retries automatically — try again in a few seconds.</p>
        <button onClick={reset} className="mt-5 rounded-full bg-white px-5 py-2 text-sm font-semibold text-slate-900">
          Try again
        </button>
      </div>
    </div>
  );
}
