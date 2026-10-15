"use client";

import { ChevronsLeft } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tip } from "@/components/ui/primitives";
import { SkyScene } from "@/components/sky/sky-scene";
import { useAppStore } from "@/hooks/use-app-store";
import { NAV_FOOTER, NAV_GROUPS, type NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";

const SPRING = { type: "spring", stiffness: 480, damping: 38 } as const;

function NavLink({ item, collapsed, onNavigate }: { item: NavItem; collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = pathname === item.href || pathname.startsWith(item.href + "/");
  const Icon = item.icon;
  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "group relative flex h-11 items-center gap-3 rounded-2xl px-3 text-[14px] font-medium transition-colors duration-300",
        active ? "text-fg" : "text-fg-muted hover:text-fg",
        collapsed && "justify-center px-0",
      )}
    >
      {active && <motion.span layoutId="nav-lens" className="glass-strong absolute inset-0 rounded-2xl" transition={SPRING} />}
      {!active && <span className="absolute inset-0 rounded-2xl bg-surface-sunken opacity-0 transition-opacity duration-300 group-hover:opacity-70" />}
      <Icon className={cn("relative size-[19px] shrink-0 stroke-[1.75] transition-transform duration-300 group-hover:scale-110", active && "text-primary")} />
      {!collapsed && <span className="relative truncate">{item.label}</span>}
    </Link>
  );
  return collapsed ? (
    <Tip content={item.label} side="right">
      {link}
    </Tip>
  ) : (
    link
  );
}

export function SidebarContent({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <Link href="/" className={cn("flex h-[68px] shrink-0 items-center px-5", collapsed && "justify-center px-0")}>
        <Logo compact={collapsed} />
      </Link>
      <nav className="scrollbar-none flex-1 overflow-y-auto px-3 pb-3" data-lenis-prevent>
        {NAV_GROUPS.map((g) => (
          <div key={g.label} className="mt-3 first:mt-0">
            {!collapsed ? (
              <div className="mb-1 px-3 text-[11.5px] font-semibold text-fg-subtle">{g.label}</div>
            ) : (
              <div className="mx-auto mb-2 mt-4 h-px w-6 bg-border-strong" />
            )}
            <div className="space-y-0.5">
              {g.items.map((item) => (
                <NavLink key={item.href} item={item} collapsed={collapsed} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        ))}
        <div className="mx-3 my-3 h-px bg-border" />
        <div className="space-y-0.5">
          {NAV_FOOTER.map((item) => (
            <NavLink key={item.href} item={item} collapsed={collapsed} onNavigate={onNavigate} />
          ))}
        </div>
      </nav>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.3 }}
            className="relative mx-3 mb-3 h-[172px] shrink-0 overflow-hidden rounded-[22px] shadow-[inset_0_0_0_0.5px_var(--lg-rim)]"
          >
            <SkyScene pm={18} landmark="vidhana" seed={3} className="absolute inset-0" particles={false} />
            <div className="absolute inset-0 bg-gradient-to-b from-white/75 via-white/15 to-transparent dark:from-black/55 dark:via-black/10" />
            <div className="relative p-4">
              <div className="text-[11px] font-medium text-fg-muted">AI for</div>
              <div className="font-display text-[18px] font-semibold leading-[1.15] text-fg">
                Cleaner Air,
                <br />
                Healthier Tomorrows
              </div>
              <div className="mt-1.5 text-[11px] text-fg-muted">For a sustainable India.</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Floating, inset glass sidebar (iPadOS / macOS 26 style). */
export function Sidebar() {
  const collapsed = useAppStore((s) => s.sidebarCollapsed);
  const toggle = useAppStore((s) => s.toggleSidebar);
  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 96 : 284 }}
      transition={{ type: "spring", stiffness: 300, damping: 34 }}
      className="sticky top-0 z-40 hidden h-dvh shrink-0 p-3 pr-0 lg:block"
    >
      <div className="glass relative h-full rounded-[30px]">
        <SidebarContent collapsed={collapsed} />
        <button
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="glass-strong absolute -right-3 top-[82px] grid size-7 place-items-center rounded-full text-fg-muted transition hover:text-fg"
        >
          <ChevronsLeft className={cn("size-3.5 transition-transform duration-300", collapsed && "rotate-180")} />
        </button>
      </div>
    </motion.aside>
  );
}
