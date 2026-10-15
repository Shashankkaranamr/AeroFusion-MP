import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";

/** Tooltips wait 400 ms the first time, then open instantly while you move between them
 *  (Emil › skip delay on subsequent hovers). Mount TooltipProvider once. */
export const TooltipProvider = ({ children }: { children: ReactNode }) => (
  <TooltipPrimitive.Provider delayDuration={400} skipDelayDuration={300}>
    {children}
  </TooltipPrimitive.Provider>
);

export function Tip({ content, children, side = "top" }: { content: ReactNode; children: ReactNode; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={8}
          collisionPadding={12}
          className="z-[80] max-w-72 bg-surface-2 px-3 py-2 text-[13px] leading-snug text-ink shadow-[inset_0_0_0_1px_var(--line-2),0_18px_40px_-18px_rgb(var(--shadow-rgb)/0.9)] data-[state=delayed-open]:animate-[pop-in_160ms_var(--ease-out)]"
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
