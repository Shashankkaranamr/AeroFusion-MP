import type { Metadata } from "next";
import { ForecastView } from "@/components/pages/forecast-view";

export const metadata: Metadata = { title: "City Forecast" };

export default function ForecastPage() {
  return <ForecastView />;
}
