import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface Option {
  value: string;
  label: string;
  /** Right-aligned reading (a value) and a dot colour. */
  hint?: string;
  dot?: string;
  group?: string;
}

/**
 * A pop-up button (HIG › Pop-up buttons): shows the current choice, opens a list, typeahead to
 * jump. Scales in from its trigger (Emil › origin-aware popovers), 180 ms.
 */
export function Select({
  value,
  onValueChange,
  options,
  label,
  prefix,
  className,
  triggerClassName,
}: {
  value: string;
  onValueChange: (v: string) => void;
  options: Option[];
  label: string;
  prefix?: ReactNode;
  className?: string;
  triggerClassName?: string;
}) {
  const cur = options.find((o) => o.value === value);
  const groups = [...new Set(options.map((o) => o.group ?? ""))];
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
      <SelectPrimitive.Trigger
        aria-label={label}
        className={cn(
          "press inline-flex h-10 min-w-0 items-center gap-2.5 pl-3.5 pr-3 text-sm text-ink shadow-[inset_0_0_0_1px_var(--line-2)] hover:bg-press-2 data-[state=open]:bg-press-2 data-[state=open]:shadow-[inset_0_0_0_1px_var(--ink)]",
          triggerClassName,
        )}
      >
        {prefix}
        {cur?.dot && <span className="size-1.5 shrink-0 rounded-full" style={{ background: cur.dot }} />}
        <span className="truncate font-medium">
          <SelectPrimitive.Value />
        </span>
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="size-4 shrink-0 text-ink-2" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={8}
          className={cn(
            "glass z-[70] max-h-[min(70vh,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden p-1",
            "origin-[var(--radix-select-content-transform-origin)] data-[state=open]:animate-[pop-in_180ms_var(--ease-out)]",
            className,
          )}
        >
          <SelectPrimitive.Viewport>
            {groups.map((g) => (
              <SelectPrimitive.Group key={g || "all"}>
                {g && <SelectPrimitive.Label className="tag px-3 pb-1 pt-2.5">{g}</SelectPrimitive.Label>}
                {options
                  .filter((o) => (o.group ?? "") === g)
                  .map((o) => (
                    <SelectPrimitive.Item
                      key={o.value}
                      value={o.value}
                      className="relative flex h-9 cursor-default select-none items-center gap-2.5 pl-8 pr-3 text-sm text-ink-2 outline-none data-[highlighted]:bg-press-2 data-[highlighted]:text-ink data-[state=checked]:text-ink"
                    >
                      <SelectPrimitive.ItemIndicator className="absolute left-2.5">
                        <Check className="size-3.5" />
                      </SelectPrimitive.ItemIndicator>
                      {o.dot && <span className="size-1.5 shrink-0 rounded-full" style={{ background: o.dot }} />}
                      <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
                      {o.hint && <span className="mono ml-auto pl-4 text-xs text-ink-2">{o.hint}</span>}
                    </SelectPrimitive.Item>
                  ))}
              </SelectPrimitive.Group>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
