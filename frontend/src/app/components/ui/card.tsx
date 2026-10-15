import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A panel (content is never glass). `i` staggers its reveal inside a .stagger parent. */
export function Card({ className, i, style, ...props }: HTMLAttributes<HTMLDivElement> & { i?: number }) {
  return <div className={cn("card min-w-0", className)} style={i === undefined ? style : ({ ...style, "--i": i } as CSSProperties)} {...props} />;
}

/**
 * Title row: a mono eyebrow (with an optional index, `03 · NEXT 24 HOURS`), a light Inter title,
 * an optional action on the right.
 */
export function CardHeader({
  eyebrow,
  title,
  action,
  index,
  className,
  children,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  action?: ReactNode;
  index?: number;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 px-5 pt-5 sm:px-6 sm:pt-6", className)}>
      <div className="min-w-0">
        {(eyebrow || index !== undefined) && (
          <div className="tag mb-3 flex items-center gap-2.5">
            {index !== undefined && <span className="text-ink">{String(index).padStart(2, "0")}</span>}
            {index !== undefined && eyebrow && <span aria-hidden className="h-px w-3 bg-line-2" />}
            {eyebrow}
          </div>
        )}
        <h3 className="text-[19px] font-normal leading-tight tracking-[-0.02em] text-ink">{title}</h3>
        {children && <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{children}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 pb-5 pt-5 sm:px-6 sm:pb-6", className)} {...props} />;
}

/** A source line under a chart: where the numbers come from. */
export function SourceNote({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("mt-4 border-t border-line pt-3 font-mono text-[10.5px] leading-relaxed tracking-[0.04em] text-ink-3", className)}>{children}</p>;
}
