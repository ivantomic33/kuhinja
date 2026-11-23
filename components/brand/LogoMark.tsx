import { cn } from "@/lib/utils/cn";
import { brandMark } from "./mark.mjs";

type LogoMarkProps = {
  className?: string;
  title?: string;
  size?: number;
};

export function LogoMark({ className, title, size = brandMark.size }: LogoMarkProps) {
  return (
    <svg
      viewBox={`0 0 ${brandMark.size} ${brandMark.size}`}
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <rect width={brandMark.size} height={brandMark.size} rx={brandMark.radius} fill={brandMark.background} />
      <rect {...brandMark.tile} fill={brandMark.accent} />
      <path d={brandMark.glyph} fill={brandMark.background} />
    </svg>
  );
}
