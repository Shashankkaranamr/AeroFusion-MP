import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Buttons. Square, drawn with a hairline; one solid white action per view (HIG › Buttons). Press
 * nudges down a pixel instead of scaling.
 */
const buttonVariants = cva(
  "press inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        /** Solid ink: the one prominent action. */
        primary: "bg-ink text-canvas hover:bg-[color-mix(in_oklab,var(--ink)_84%,var(--bg))]",
        /** Outlined, for secondary actions. */
        tinted: "text-ink shadow-[inset_0_0_0_1px_var(--line-2)] hover:bg-press-2 hover:shadow-[inset_0_0_0_1px_rgb(var(--ink-rgb)/0.4)]",
        /** Text only. */
        ghost: "text-ink-2 hover:bg-press hover:text-ink",
      },
      size: {
        sm: "h-8 px-3 text-[13px]",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-[15px]",
        icon: "size-10 shrink-0",
        "icon-sm": "size-8 shrink-0",
      },
    },
    defaultVariants: { variant: "tinted", size: "md" },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, type = "button", ...props }, ref) => (
  <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
));
Button.displayName = "Button";
export { buttonVariants };

/** The call-to-action mark: a thin ↗ that slides a step up and right on hover. */
export function ArrowUpRightMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 10 10"
      fill="none"
      aria-hidden
      className={cn("size-[0.7rem] shrink-0 transition-transform duration-500 ease-[var(--ease-out)] group-hover:-translate-y-0.5 group-hover:translate-x-0.5", className)}
    >
      <path d="M1.5 8.5 8.5 1.5M8.5 1.5H2.8M8.5 1.5v5.7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="square" />
    </svg>
  );
}

/**
 * The outlined call to action — `EXPLORE THE CORE ↗`: mono, uppercase, widely tracked, inside a
 * hairline. On hover, ink wipes in from the left and the label inverts. Kept for real calls to
 * action only.
 */
export const InteractiveHoverButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { text: string; icon?: ReactNode }>(
  ({ text, icon, className, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "press group relative isolate inline-flex h-12 min-w-36 cursor-pointer items-center justify-between gap-6 overflow-hidden px-6 text-left font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-ink shadow-[inset_0_0_0_1px_var(--line-2)]",
        "transition-[color,box-shadow] duration-500 ease-[var(--ease-out)] hover:text-canvas hover:shadow-[inset_0_0_0_1px_var(--ink)]",
        className,
      )}
      {...props}
    >
      <span aria-hidden className="absolute inset-0 -z-10 origin-left scale-x-0 bg-ink transition-transform duration-500 ease-[var(--ease-out)] group-hover:scale-x-100" />
      <span className="inline-flex min-w-0 items-center gap-2.5 truncate [&_svg]:size-3.5">
        {icon}
        {text}
      </span>
      <ArrowUpRightMark />
    </button>
  ),
);
InteractiveHoverButton.displayName = "InteractiveHoverButton";
