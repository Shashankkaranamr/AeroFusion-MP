import { Check } from "lucide-react";
import { Card, CardBody, CardHeader, SourceNote } from "@/components/ui/card";
import { PulsatingLoader } from "@/components/ui/loader";
import { useApi } from "@/lib/api";
import { fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Mirrors ml/aerofusion_ml/evaluate.py metrics.json (only the fields shown here). */
interface Block {
  n: number;
  rmse: number | null;
  mae: number | null;
  skill_vs_persistence?: number | null;
  skill_vs_cams?: number | null;
}
interface ModelMetrics {
  status: "measured" | "pending";
  message?: string;
  run_id?: string;
  split?: string;
  setting?: string;
  leads?: Record<string, { city: Block; station: Block }>;
}

/** The forecast model's ladder (PROGRESS P3). Each rung adds one part; all are reported, helpful or not. */
const RUNGS: [string, string][] = [
  ["M0", "Per-station recurrent network on pollution and weather history"],
  ["M1", "+ a wind-aware graph linking each station to its upwind neighbours"],
  ["M2", "+ a graph the model learns for itself"],
  ["M3", "+ a Transformer reading the last 72 hours"],
  ["M4", "+ wavelet bands, computed only from the past"],
  ["M5", "+ a ConvLSTM over gridded weather, fire and CAMS maps"],
  ["M6", "+ source-group gating: learned attribution, not causal shares"],
];

const pct = (v: number | null | undefined) => (v == null ? "—" : `${v > 0 ? "+" : ""}${Math.round(v * 100)}%`);

/** Honest model status: numbers only from a measured run (run ID shown), otherwise what is being built. */
export function ModelStatus() {
  const m = useApi<ModelMetrics>("/api/model/metrics");
  const measured = m.data?.status === "measured" && m.data.leads && m.data.run_id;
  return (
    <Card className="mt-4">
      <CardHeader eyebrow="MW-AeroFusion-Net" title="Our forecast model">
        {measured
          ? `Scored on held-out ${m.data!.split} data in setting ${m.data!.setting}. Skill is the error reduction against simply repeating the last reading, and against CAMS.`
          : "Being trained and evaluated. No accuracy is shown until a frozen model has been scored on data it never saw."}
      </CardHeader>
      <CardBody>
        {m.loading ? (
          <PulsatingLoader label="Asking for the model's status" />
        ) : measured ? (
          <>
            <table className="w-full text-[13px]">
              <thead className="tag text-left text-ink-3">
                <tr>
                  <th className="py-2 font-medium">Ahead</th>
                  <th className="py-2 text-right font-medium">Error (RMSE)</th>
                  <th className="py-2 text-right font-medium">vs last reading</th>
                  <th className="py-2 text-right font-medium">vs CAMS</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(m.data!.leads!).map(([lead, b]) => (
                  <tr key={lead} className="border-t border-line">
                    <td className="py-2 text-ink">+{lead} h</td>
                    <td className="mono py-2 text-right">{b.city.rmse == null ? "—" : `${fmtNum(Math.round(b.city.rmse))} µg/m³`}</td>
                    <td className="mono py-2 text-right">{pct(b.city.skill_vs_persistence)}</td>
                    <td className="mono py-2 text-right">{pct(b.city.skill_vs_cams)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <SourceNote className="mt-3">City averages of station forecasts. Run {m.data!.run_id}.</SourceNote>
          </>
        ) : (
          <ol className="grid gap-2 text-[13px]">
            {RUNGS.map(([id, text]) => (
              <li key={id} className="flex items-start gap-2.5">
                <span className={cn("mono mt-0.5 w-7 shrink-0 text-[11px] text-ink-3")}>{id}</span>
                <span className="text-ink-2">{text}</span>
                <span className="ml-auto mt-0.5 grid size-4 shrink-0 place-items-center shadow-[inset_0_0_0_1px_var(--line-2)]" aria-label="code written, not yet trained">
                  <Check className="size-3 text-ink-3" strokeWidth={2.5} />
                </span>
              </li>
            ))}
            <li className="mt-1 text-[12.5px] text-ink-3">Ticks mean the code exists and is tested; training starts once the GPU machine is available.</li>
          </ol>
        )}
      </CardBody>
    </Card>
  );
}
