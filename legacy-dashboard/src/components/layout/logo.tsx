"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  // Unique gradient ids: several marks render at once and some live in display:none containers.
  const uid = useId().replace(/:/g, "");
  const a = `af-leaf-a-${uid}`;
  const b = `af-leaf-b-${uid}`;
  return (
    <svg viewBox="0 0 40 40" fill="none" className={cn("size-9", className)} aria-hidden>
      <defs>
        <linearGradient id={a} x1="6" y1="34" x2="30" y2="4" gradientUnits="userSpaceOnUse">
          <stop stopColor="#138a76" />
          <stop offset="0.55" stopColor="#4cc9b0" />
          <stop offset="1" stopColor="#9ad8ff" />
        </linearGradient>
        <linearGradient id={b} x1="34" y1="34" x2="14" y2="8" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3b6fe0" />
          <stop offset="1" stopColor="#8fb0ff" />
        </linearGradient>
      </defs>
      {/* left leaf */}
      <path d="M19.5 35C10 33 4.5 25.5 6.5 14.5 14.5 15 20.5 21 19.5 35Z" fill={`url(#${a})`} />
      {/* right leaf */}
      <path d="M20.5 35c9.5-2 15-9.5 13-20.5-8 .5-14 6.5-13 20.5Z" fill={`url(#${b})`} opacity=".92" />
      {/* centre bud */}
      <path d="M20 33.5C15.6 27 15.6 14.5 20 5c4.4 9.5 4.4 22 0 28.5Z" fill={`url(#${a})`} />
      {/* airflow */}
      <path d="M11 24.5c3.2-1.6 6-.4 9 1.2 3 1.6 5.8 2.6 9 1" stroke="white" strokeOpacity=".85" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M13 19.5c2.4-1 4.6-.2 7 .9 2.4 1.1 4.6 1.8 7 .8" stroke="white" strokeOpacity=".55" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ compact, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      {!compact && (
        <div className="leading-none">
          <div className="font-hero text-[19px] font-bold tracking-tight text-fg">
            Aero<span className="text-primary">Fusion</span>
          </div>
          <div className="mt-1 text-[10.5px] font-medium tracking-wide text-fg-subtle">MW-AeroFusion-Net</div>
        </div>
      )}
    </div>
  );
}
