import type { Metadata } from "next";
import { LiveDataView } from "@/components/pages/live-data-view";

export const metadata: Metadata = { title: "Data Sources" };

export default function DataSourcesPage() {
  return <LiveDataView />;
}
