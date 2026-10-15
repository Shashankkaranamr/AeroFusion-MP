import type { Metadata } from "next";
import { LiveDataView } from "@/components/pages/live-data-view";

export const metadata: Metadata = { title: "Live Data Fusion" };

export default function PipelinePage() {
  return <LiveDataView />;
}
