import type { SVGProps } from "react";

/** From 21st.dev: a check that draws itself once (0.6 s). Used where something finished: a source is
 *  healthy, a refresh landed, a file was saved, a link was copied. */
export function ConfirmIcon({ size = 16, ...props }: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path fill="none" stroke="currentColor" strokeDasharray="26" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" d="M5 11l6 6l10 -10">
        <animate fill="freeze" attributeName="stroke-dashoffset" dur="0.6s" values="26;0" />
      </path>
    </svg>
  );
}
