import type { Metadata } from "next";
import { SimulatorView } from "@/components/pages/simulator-view";

export const metadata: Metadata = { title: "What-if Simulator" };

export default function SimulatorPage() {
  return <SimulatorView />;
}
