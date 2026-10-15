import { useId } from "react";
import { motion } from "motion/react";
import { sound } from "@/lib/sound";
import { cn } from "@/lib/utils";

/**
 * A segmented control (HIG › Segmented controls): a few mutually exclusive choices. The selected
 * block slides on the expo-out curve; arrow keys move between options (radiogroup).
 */
export function Segmented<T extends string>({ value, onChange, options, label, className, size = "md" }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label: string; className?: string; size?: "sm" | "md" }) {
  const id = useId();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("no-scrollbar inline-flex max-w-full overflow-x-auto p-px shadow-[inset_0_0_0_1px_var(--line-2)]", className)}
      onKeyDown={(e) => {
        const i = options.findIndex((o) => o.value === value);
        if (e.key === "ArrowRight" || e.key === "ArrowDown") onChange(options[(i + 1) % options.length].value);
        if (e.key === "ArrowLeft" || e.key === "ArrowUp") onChange(options[(i - 1 + options.length) % options.length].value);
      }}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={on ? 0 : -1}
            onClick={() => {
              sound.tick();
              onChange(o.value);
            }}
            className={cn("press relative shrink-0 whitespace-nowrap font-medium transition-colors duration-200", size === "sm" ? "h-7 px-3 text-[12.5px]" : "h-9 px-4 text-[13px]", on ? "text-canvas" : "text-ink-2 hover:text-ink")}
          >
            {on && <motion.span layoutId={`seg-${id}`} className="absolute inset-0 bg-ink" transition={{ type: "tween", ease: [0.19, 1, 0.22, 1], duration: 0.5 }} />}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
