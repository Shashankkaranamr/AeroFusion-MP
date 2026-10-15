"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_CITY } from "@/lib/cities";

interface AppState {
  city: string;
  setCity: (slug: string) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  mobileNavOpen: boolean;
  setMobileNav: (open: boolean) => void;
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
  demoBannerDismissed: boolean;
  dismissDemoBanner: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      city: DEFAULT_CITY,
      setCity: (slug) => set({ city: slug }),
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      mobileNavOpen: false,
      setMobileNav: (open) => set({ mobileNavOpen: open }),
      commandOpen: false,
      setCommandOpen: (open) => set({ commandOpen: open }),
      demoBannerDismissed: false,
      dismissDemoBanner: () => set({ demoBannerDismissed: true }),
    }),
    {
      name: "aerofusion-ui",
      partialize: (s) => ({ city: s.city, sidebarCollapsed: s.sidebarCollapsed, demoBannerDismissed: s.demoBannerDismissed }),
      skipHydration: true,
    },
  ),
);
