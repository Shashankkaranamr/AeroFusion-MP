// Relay for the AeroFusion backend: free Open-Meteo is rate-limited per IP and the backend's cloud host shares
// its IP with many apps. This forwards ONLY to the two Open-Meteo endpoints the backend uses (not an open proxy).
const TARGETS: Record<string, string> = {
  air: "https://air-quality-api.open-meteo.com/v1/air-quality",
  forecast: "https://api.open-meteo.com/v1/forecast",
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const base = TARGETS[url.searchParams.get("target") ?? ""];
  if (!base) return Response.json({ error: "unknown target" }, { status: 400 });
  url.searchParams.delete("target");
  const r = await fetch(`${base}?${url.searchParams.toString()}`, { cache: "no-store", headers: { "User-Agent": "AeroFusion relay" } });
  return new Response(await r.text(), { status: r.status, headers: { "content-type": "application/json" } });
}
