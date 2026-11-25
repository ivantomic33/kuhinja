import { checkoutHref } from "@/lib/billing/checkout-intent";

export const ctaClass = "focus-ring inline-flex min-h-11 min-w-11 items-center justify-center rounded-[var(--radius-input)] px-5 py-2.5 text-center text-sm font-semibold";
export const primaryCtaClass = `${ctaClass} bg-accent text-accent-ink hover:bg-accent-hover active:bg-accent-pressed`;
export const secondaryCtaClass = `${ctaClass} border border-border-strong bg-surface-2 text-text hover:bg-surface-3`;
export const textLinkClass = "focus-ring inline-flex min-h-11 min-w-11 items-center rounded-sm font-semibold text-text-2 hover:text-text hover:underline";

export const trialHref = checkoutHref("pro", "monthly");
