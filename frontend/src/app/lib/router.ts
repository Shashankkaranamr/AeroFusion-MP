import { useEffect, useState } from "react";

/**
 * Hash routes, so the dashboard works from any static host and any sub-path:
 *   #/now  #/map  #/city/delhi  #/why  #/what-if  #/history  #/data
 */
export type ViewId = "now" | "map" | "city" | "why" | "what-if" | "history" | "data";
export const VIEWS: ViewId[] = ["now", "map", "city", "why", "what-if", "history", "data"];

export interface Route {
  view: ViewId;
  /** #/city/<slug> */
  slug?: string;
  /** ?from=story — arrived from the story's handoff (plays the particles-to-map arrival once). */
  fromStory: boolean;
  /** ?city=<slug> — the city picked in the story's "Where do you breathe?" */
  city?: string;
  /** ?ask=1 — open "Ask the data" on arrival */
  ask: boolean;
}

export function parse(hash = window.location.hash): Route {
  const [path, query = ""] = hash.replace(/^#\/?/, "").split("?");
  const [view, slug] = path.split("/");
  const q = new URLSearchParams(query);
  return { view: (VIEWS as string[]).includes(view) ? (view as ViewId) : "now", slug: slug || undefined, fromStory: q.get("from") === "story", city: q.get("city") ?? undefined, ask: q.get("ask") === "1" };
}

export const href = (view: ViewId, slug?: string) => `#/${view}${slug ? `/${slug}` : ""}`;

export function navigate(view: ViewId, slug?: string) {
  window.location.hash = href(view, slug);
}

export function useRoute() {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => setRoute(parse());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}
