import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

/** A slider (HIG › Sliders). With `centered`, the fill grows from zero, so −/+ reads as direction. */
export function Slider({
  value,
  onValueChange,
  min,
  max,
  step = 1,
  label,
  className,
  centered = false,
}: {
  value: number;
  onValueChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  label: string;
  className?: string;
  centered?: boolean;
}) {
  const zero = centered ? ((0 - min) / (max - min)) * 100 : 0;
  const at = ((value - min) / (max - min)) * 100;
  return (
    <SliderPrimitive.Root
      value={[value]}
      onValueChange={(v) => onValueChange(v[0])}
      min={min}
      max={max}
      step={step}
      className={cn("relative flex h-7 w-full touch-none select-none items-center", className)}
    >
      <SliderPrimitive.Track className="relative h-px grow overflow-hidden bg-line-2">
        <span className="absolute inset-y-0 bg-ink" style={{ left: `${Math.min(zero, at)}%`, width: `${Math.abs(at - zero)}%` }} />
      </SliderPrimitive.Track>
      {centered && <span aria-hidden className="pointer-events-none absolute h-3 w-px bg-ink-3" style={{ left: `${zero}%` }} />}
      <SliderPrimitive.Thumb
        aria-label={label}
        className="block size-3.5 bg-ink shadow-[0_0_0_4px_var(--surface)] transition-[transform,box-shadow] duration-300 ease-[var(--ease-out)] hover:shadow-[0_0_0_4px_var(--surface),0_0_14px_2px_rgb(var(--ink-rgb)/0.35)] active:scale-90"
      />
    </SliderPrimitive.Root>
  );
}
