"use client";

import { getCity } from "@/lib/cities";
import { useAppStore } from "./use-app-store";

export function useCity() {
  const slug = useAppStore((s) => s.city);
  return getCity(slug);
}
