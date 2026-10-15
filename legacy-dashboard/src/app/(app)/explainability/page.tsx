import type { Metadata } from "next";
import { ExplainView } from "@/components/pages/explain-view";

export const metadata: Metadata = { title: "Explainability" };

export default function ExplainabilityPage() {
  return <ExplainView />;
}
