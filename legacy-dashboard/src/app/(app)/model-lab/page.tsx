import type { Metadata } from "next";
import { ModelLabView } from "@/components/pages/model-lab-view";

export const metadata: Metadata = { title: "Model Lab" };

export default function ModelLabPage() {
  return <ModelLabView />;
}
