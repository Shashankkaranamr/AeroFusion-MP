"use client";

import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { Dialog } from "radix-ui";
import { Suspense, useEffect, type ReactNode } from "react";
import { useAppStore } from "@/hooks/use-app-store";
import { CITY_BY_SLUG } from "@/lib/cities";
import { CommandMenu } from "./command-menu";
import { Footer } from "./footer";
import { Sidebar, SidebarContent } from "./sidebar";
import { TabBar } from "./tab-bar";
import { Topbar } from "./topbar";

function MobileNav() {
  const open = useAppStore((s) => s.mobileNavOpen);
  const setOpen = useAppStore((s) => s.setMobileNav);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm lg:hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount aria-describedby={undefined}>
              <motion.div
                className="glass-pop fixed inset-y-3 left-3 z-[81] w-[288px] rounded-[30px] lg:hidden"
                initial={{ x: -300 }}
                animate={{ x: 0 }}
                exit={{ x: -300 }}
                transition={{ type: "spring", stiffness: 380, damping: 38 }}
              >
                <Dialog.Title className="sr-only">Navigation</Dialog.Title>
                <Dialog.Close className="absolute right-3 top-4 z-10 grid size-9 place-items-center rounded-full text-fg-muted hover:bg-surface-sunken">
                  <X className="size-5" />
                </Dialog.Close>
                <SidebarContent collapsed={false} onNavigate={() => setOpen(false)} />
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

function CityFromQuery() {
  const params = useSearchParams();
  const setCity = useAppStore((s) => s.setCity);
  const q = params.get("city");
  useEffect(() => {
    if (q && CITY_BY_SLUG[q]) setCity(q);
  }, [q, setCity]);
  return null;
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="photo-theme flex min-h-dvh">
      <div className="pointer-events-none fixed inset-0 z-[-1]" aria-hidden>
        <Image src="/hero/app-bg.webp" alt="" fill priority sizes="100vw" quality={100} className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0b1d33]/45 via-[#0b1d33]/25 to-[#0b1d33]/55" />
        <div className="absolute inset-0 hidden bg-[#050a14]/35 dark:block" />
      </div>
      <Sidebar />
      <div className="relative flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="relative flex-1 px-4 pb-10 sm:px-6 lg:px-8">{children}</main>
        <Footer />
        <div className="h-24 lg:hidden" />
      </div>
      <TabBar />
      <MobileNav />
      <CommandMenu />
      <Suspense fallback={null}>
        <CityFromQuery />
      </Suspense>
    </div>
  );
}
