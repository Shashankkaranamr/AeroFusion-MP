import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Capsule buttons in the Liquid Glass style: tinted glass for primary actions, clear glass otherwise. */
export const buttonVariants = cva(
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-[transform,filter,background,box-shadow] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.96] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "glass-tint hover:brightness-[1.06]",
        dark: "bg-fg text-bg shadow-lift hover:opacity-90",
        secondary: "glass text-fg hover:brightness-[1.03]",
        ghost: "text-fg-muted hover:bg-surface-sunken hover:text-fg",
        soft: "bg-primary-soft text-primary hover:brightness-95",
        outline: "glass text-fg hover:text-primary",
      },
      size: {
        sm: "h-8 px-3.5 text-xs",
        md: "h-10 px-4.5",
        lg: "h-12 px-6 text-[15px]",
        icon: "size-10",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
