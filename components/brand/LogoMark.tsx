import { cn } from "@/lib/utils/cn";

/**
 * Brand mark — chef-hat metaphor on accent square.
 */
type LogoMarkProps = {
  className?: string;
  title?: string;
};

export function LogoMark({ className, title }: LogoMarkProps) {
  return (
    <svg
      viewBox="0 0 36 36"
      className={cn("shrink-0", className ?? "size-9")}
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <rect width="36" height="36" rx="10" fill="#ff6b35" />
      {/* Chef hat outline */}
      <g
        fill="none"
        stroke="#1a0a03"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10 22.5h16v3.5H10z" />
        <path d="M12 22.5c0-5 2.2-9 6-9s6 4 6 9" />
        <path d="M14.5 15.5c-.8-1.6.2-3.2 2-3.2 1 0 1.6.5 1.8 1.2.4-1.4 1.8-2.2 3.2-1.6 1.2.5 1.6 1.8 1.2 2.8" />
      </g>
    </svg>
  );
}
