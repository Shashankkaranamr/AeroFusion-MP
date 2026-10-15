"use client";

import { CloudSun, Ellipsis, LayoutDashboard, MapPinned, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppStore } from "@/hooks/use-app-store";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/forecast", label: "Forecast", icon: CloudSun },
  { href: "/live-map", label: "Map", icon: MapPinned },
  { href: "/explainability", label: "Explain", icon: Sparkles },
];

/** iOS-style floating Liquid Glass tab bar (phones & small tablets). */
export function TabBar() {
  const pathname = usePathname();
  const setMobileNav = useAppStore((s) => s.setMobileNav);
  const activeIdx = TABS.findIndex((t) => pathname.startsWith(t.href));
  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[max(12px,env(safe-area-inset-bottom))] lg:hidden">
      <div className="glass flex w-full max-w-[420px] items-center gap-1 rounded-full p-1.5">
        {TABS.map((t, i) => {
          const active = i === activeIdx;
          const Icon = t.icon;
          return (
            <Link key={t.href} href={t.href} className="relative flex h-[52px] flex-1 flex-col items-center justify-center gap-0.5 rounded-full">
              {active && (
                <motion.span layoutId="tab-lens" className="glass-strong absolute inset-0 rounded-full" transition={{ type: "spring", stiffness: 480, damping: 36 }} />
              )}
              <Icon className={cn("relative size-[21px] stroke-[1.75]", active ? "text-primary" : "text-fg-muted")} />
              <span className={cn("relative text-[10px] font-semibold", active ? "text-primary" : "text-fg-muted")}>{t.label}</span>
            </Link>
          );
        })}
        <button onClick={() => setMobileNav(true)} className="relative flex h-[52px] flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-fg-muted">
          <Ellipsis className="size-[21px] stroke-[1.75]" />
          <span className="text-[10px] font-semibold">More</span>
        </button>
      </div>
    </nav>
  );
}
