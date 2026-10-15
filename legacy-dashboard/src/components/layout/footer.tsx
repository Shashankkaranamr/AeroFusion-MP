import Link from "next/link";

export function Footer() {
  return (
    <footer className="no-print border-t border-border px-4 py-6 text-xs text-fg-subtle sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          © 2026 AeroFusion · Explainable air-quality forecasting for India
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>
            Data: <span className="font-semibold text-primary">CAMS · Open-Meteo · NASA FIRMS & GIBS · CPCB (XKDR)</span>
          </span>
          <span>
            Boundaries:{" "}
            <a className="underline-offset-2 hover:underline" href="https://github.com/datameet/maps" target="_blank" rel="noreferrer">
              DataMeet (CC BY 4.0)
            </a>
          </span>
          <Link href="/about" className="underline-offset-2 hover:underline">
            Methodology & integrity
          </Link>
        </div>
      </div>
    </footer>
  );
}
