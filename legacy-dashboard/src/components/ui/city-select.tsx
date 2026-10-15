"use client";

import { Command } from "cmdk";
import { Check, ChevronDown, MapPin, Search } from "lucide-react";
import { Popover } from "radix-ui";
import { useMemo, useState } from "react";
import { useAppStore } from "@/hooks/use-app-store";
import { useLive } from "@/hooks/use-live";
import { categoryForPm } from "@/lib/aqi";
import { CITIES, getCity } from "@/lib/cities";
import { cn } from "@/lib/utils";

export function CitySelect({ className, size = "md" }: { className?: string; size?: "md" | "lg" }) {
  const slug = useAppStore((s) => s.city);
  const setCity = useAppStore((s) => s.setCity);
  const { snap } = useLive();
  const [open, setOpen] = useState(false);
  const city = getCity(slug);
  const values = useMemo<Record<string, number>>(() => (snap ? Object.fromEntries(snap.cities.filter((c) => c.pm25 !== null).map((c) => [c.slug, c.pm25 as number])) : {}), [snap]);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className={cn(
            "glass group inline-flex items-center gap-2.5 rounded-full text-left transition hover:brightness-[1.03]",
            size === "lg" ? "h-14 min-w-[260px] px-5" : "h-11 min-w-[200px] px-4",
            className,
          )}
        >
          <MapPin className={cn("shrink-0 text-primary", size === "lg" ? "size-5" : "size-4")} />
          <span className="min-w-0 flex-1">
            <span className={cn("block truncate font-display font-semibold text-fg", size === "lg" ? "text-lg" : "text-sm")}>
              {city.name}
            </span>
            {size === "lg" && <span className="block truncate text-xs text-fg-subtle">{city.state}</span>}
          </span>
          <ChevronDown className={cn("size-4 shrink-0 text-fg-subtle transition-transform duration-300", open && "rotate-180")} />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={8}
          className="glass-pop z-[90] w-[320px] overflow-hidden rounded-[26px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-top-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
        >
          <Command loop>
            <div className="flex items-center gap-2 border-b border-border px-3">
              <Search className="size-4 text-fg-subtle" />
              <Command.Input
                autoFocus
                placeholder="Search 33 cities…"
                className="h-11 flex-1 bg-transparent text-sm outline-none placeholder:text-fg-subtle"
              />
            </div>
            <Command.List className="max-h-[320px] overflow-y-auto p-1.5 scrollbar-thin" data-lenis-prevent>
              <Command.Empty className="py-8 text-center text-sm text-fg-muted">No city found.</Command.Empty>
              {CITIES.map((c) => {
                const v = values[c.slug];
                const cat = v !== undefined ? categoryForPm(v) : null;
                return (
                  <Command.Item
                    key={c.slug}
                    value={`${c.name} ${c.state}`}
                    onSelect={() => {
                      setCity(c.slug);
                      setOpen(false);
                    }}
                    className="flex cursor-pointer items-center gap-2.5 rounded-2xl px-2.5 py-2 text-sm outline-none data-[selected=true]:bg-surface-sunken"
                  >
                    <Check className={cn("size-4 text-primary", c.slug === slug ? "opacity-100" : "opacity-0")} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-fg">{c.name}</span>
                      <span className="block truncate text-[11px] text-fg-subtle">{c.state}</span>
                    </span>
                    {cat && v !== undefined && (
                      <span className="flex items-center gap-1.5 text-xs tabular text-fg-muted">
                        <span className="size-2 rounded-full" style={{ background: cat.color }} />
                        {Math.round(v)}
                      </span>
                    )}
                  </Command.Item>
                );
              })}
            </Command.List>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
