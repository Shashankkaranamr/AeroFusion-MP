import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

type Variant = "left" | "right" | "center";

const underline: Record<Variant, string> = {
  left: "before:origin-right before:scale-x-0 hover:before:origin-left hover:before:scale-x-100 focus-visible:before:scale-x-100",
  right: "before:origin-left before:scale-x-0 hover:before:origin-right hover:before:scale-x-100 focus-visible:before:scale-x-100",
  center: "before:origin-center before:scale-x-0 hover:before:scale-x-100 focus-visible:before:scale-x-100",
};

/** After 21st.dev's AnimatedLink: an underline that wipes in on hover and an arrow that draws itself. */
export function AnimatedLink({ variant = "left", showArrow = true, className, children, ...props }: ComponentPropsWithoutRef<"a"> & { variant?: Variant; showArrow?: boolean }) {
  return (
    <a
      className={cn(
        "group relative inline-flex w-fit items-center text-ink",
        "before:pointer-events-none before:absolute before:left-0 before:top-[1.45em] before:h-px before:w-full before:bg-current before:content-['']",
        "before:transition-transform before:duration-300 before:ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:before:transition-none",
        underline[variant],
        className,
      )}
      {...props}
    >
      {children}
      {showArrow && (
        <svg className="ml-[0.3em] size-[0.6em]" fill="none" viewBox="0 0 10 10" aria-hidden="true">
          <path
            d="M1.004 9.166 9.337.833m0 0v8.333m0-8.333H1.004"
            stroke="currentColor"
            strokeWidth="1.25"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="[stroke-dasharray:32] [stroke-dashoffset:32] transition-[stroke-dashoffset] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] group-hover:[stroke-dashoffset:0] group-focus-visible:[stroke-dashoffset:0] motion-reduce:transition-none"
          />
        </svg>
      )}
    </a>
  );
}
