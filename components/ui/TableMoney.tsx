import { cn } from "@/lib/utils/cn";
import { formatMoney } from "@/lib/utils/format";

export function TableMoney({ value, unit }: { value: number; unit?: string }) {
  return (
    <span className={cn("money-amount", unit && "money-amount--with-unit")}>
      <span>{formatMoney(value, { fractionDigits: 2 })}</span>{" "}
      <span className={unit ? "font-normal text-text-3" : undefined}>
        {unit ? `din/${unit}` : "din"}
      </span>
    </span>
  );
}
