import type { Metadata } from "next";
import { LiveMapView } from "@/components/pages/live-map-view";

export const metadata: Metadata = { title: "Live Map" };

export default function LiveMapPage() {
  return <LiveMapView />;
}
