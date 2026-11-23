"use client";

import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { sr } from "@/lib/i18n/sr";
import type { FreeLimitCode } from "@/lib/plan/free-limit";

export type FreeLimitSheetProps = {
  open: boolean;
  onClose: () => void;
  code?: FreeLimitCode | null;
};

function messageForCode(code?: FreeLimitCode | null): string {
  switch (code) {
    case "FREE_LIMIT_INGREDIENTS":
      return sr.premium.limits.ingredients;
    case "FREE_LIMIT_RECIPES":
      return sr.premium.limits.recipes;
    case "FREE_LIMIT_TEMPLATES":
      return sr.premium.limits.templates;
    case "FREE_LIMIT_TIMERS":
      return sr.premium.limits.timers;
    case "FREE_LIMIT_STOCK_ITEMS":
      return sr.premium.limits.stockItems;
    case "FREE_LIMIT_PRICE_HISTORY":
      return sr.premium.limits.priceHistory;
    default:
      return sr.premium.limits.generic;
  }
}

/**
 * Non-blocking upgrade prompt when a free limit is hit.
 * Does not freeze the rest of the UI beyond the sheet itself.
 */
export function FreeLimitSheet({ open, onClose, code }: FreeLimitSheetProps) {
  const router = useRouter();

  function goPremium() {
    onClose();
    router.push("/premium");
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={sr.premium.limitTitle}
    >
      <div className="flex flex-col gap-2 pb-1">
        <p className="text-base text-text">{messageForCode(code)}</p>
        <PrimaryButton
          fullWidth
          onClick={goPremium}
          leftIcon={<Sparkles className="size-5" aria-hidden="true" />}
        >
          {sr.premium.ctaShort}
        </PrimaryButton>
      </div>
    </BottomSheet>
  );
}
