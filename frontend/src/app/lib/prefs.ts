import { createContext, createElement, useCallback, useContext, useState, type ReactNode } from "react";
import { DEFAULT_CITY, CITY_BY_SLUG } from "./cities";

/** What the reader chose, remembered on this device: their city, and which AI writes the insights. */
interface Prefs {
  city: string;
  setCity: (slug: string) => void;
  provider: string;
  setProvider: (id: string) => void;
}

const KEY = "aerofusion:prefs";
const read = (): Partial<Prefs> => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
};
const write = (p: { city: string; provider: string }) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* private mode: preferences last for this visit only */
  }
};

const Ctx = createContext<Prefs | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const saved = read();
  const [city, setCityState] = useState(saved.city && CITY_BY_SLUG[saved.city] ? saved.city : DEFAULT_CITY);
  const [provider, setProviderState] = useState(saved.provider ?? "auto");
  const setCity = useCallback(
    (slug: string) => {
      if (!CITY_BY_SLUG[slug]) return;
      setCityState(slug);
      write({ city: slug, provider });
    },
    [provider],
  );
  const setProvider = useCallback(
    (id: string) => {
      setProviderState(id);
      write({ city, provider: id });
    },
    [city],
  );
  return createElement(Ctx.Provider, { value: { city, setCity, provider, setProvider } }, children);
}

export function usePrefs() {
  const c = useContext(Ctx);
  if (!c) throw new Error("usePrefs must be used inside <PrefsProvider>");
  return c;
}
