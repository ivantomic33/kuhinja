import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Badge } from "./Badge";
import { BentoCard } from "./BentoCard";

export type PricingCardProps = {
  name: string;
  price: ReactNode;
  priceHint?: string;
  description?: string;
  features: readonly string[];
  cta: ReactNode;
  highlighted?: boolean;
  /** Already-on-this-plan state. Calmer than the sales highlight. */
  active?: boolean;
  /** Recede a card so it does not compete with the offer. */
  quiet?: boolean;
  badge?: string;
  className?: string;
};

export function PricingCard({
  name,
  price,
  priceHint,
  description,
  features,
  cta,
  highlighted = false,
  active = false,
  quiet = false,
  badge,
  className,
}: PricingCardProps) {
  return (
    <BentoCard
      className={cn(
        "relative h-full",
        quiet && "card-quiet",
        highlighted &&
          "border-accent/60 ring-1 ring-accent/10",
        active &&
          "border-success/40",
        className
      )}
    >
      <div className="flex h-full flex-col gap-6 sm:p-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3
              className={cn(
                "font-semibold text-text",
                highlighted || active ? "text-xl" : "text-lg"
              )}
            >
              {name}
            </h3>
            {description ? (
              <p className="mt-0.5 text-sm text-muted">{description}</p>
            ) : null}
          </div>
          {badge ? (
            <Badge variant={active ? "success" : "accent"}>{badge}</Badge>
          ) : null}
        </div>

        <div className="flex flex-col gap-0.5">
          <div
            className={cn(
              "font-semibold tracking-tight tabular-nums",
              quiet ? "text-2xl text-muted" : "text-3xl text-text"
            )}
          >
            {price}
          </div>
          {priceHint ? <p className="text-sm text-muted">{priceHint}</p> : null}
        </div>

        <ul className="flex flex-col gap-4 border-t border-border pt-6">
          {features.map((feature) => (
            <li
              key={feature}
              className={cn(
                "flex items-start gap-2 text-sm leading-snug",
                quiet ? "text-muted" : "text-text"
              )}
            >
              <span
                className={cn(
                  "mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full",
                  highlighted && "bg-[var(--accent-muted)] text-accent",
                  active && "bg-[var(--success-muted)] text-success",
                  !highlighted && !active && "bg-surface-2 text-muted"
                )}
              >
                <Check className="size-3.5" aria-hidden="true" />
              </span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        <div className="mt-auto pt-2">{cta}</div>
      </div>
    </BentoCard>
  );
}
