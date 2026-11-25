import Link from "next/link";
import { PaddleCheckout } from "@/components/billing/PaddleCheckout";
import { LogoMark } from "@/components/brand/LogoMark";
import { APP_NAME } from "@/lib/config/app";
import { checkoutHref, checkoutIntent } from "@/lib/billing/checkout-intent";
import { PLANS } from "@/lib/billing/plans";
import { sr } from "@/lib/i18n/sr";
import { getPlanDetails } from "@/lib/supabase/plan-server";
import { createCheckoutSession } from "./actions";
import { requireCheckoutUser } from "./session";

export const metadata = {
  title: "Naplata",
  robots: { index: false, follow: false },
};

/**
 * Default Paddle payment link page.
 * Set Checkout → Checkout settings → Default payment link to:
 *   https://<your-domain>/checkout
 * Paddle.js opens overlay checkout for `?_ptxn=` automatically once initialized.
 */
export default async function CheckoutPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const intent = checkoutIntent.safeParse(params);
  if (intent.success && params._ptxn === undefined) {
    const { plan_key, interval } = intent.data;
    const href = checkoutHref(plan_key, interval);
    await requireCheckoutUser(href);

    const copy = sr.marketing.landing;
    return (
      <main className="page-gutter mx-auto flex min-h-[70dvh] max-w-lg flex-col items-center justify-center gap-5 py-16 text-center">
        <LogoMark className="size-12" />
        <h1 className="text-2xl font-semibold">{copy.checkoutTitle(PLANS[plan_key].name)}</h1>
        <p className="text-text-2">{interval === "monthly" ? copy.monthly : copy.yearly}</p>
        {plan_key !== "advanced" && <p className="text-sm text-text-2">{copy.trialEligibility}</p>}
        {params.error === "1" && <p role="alert" className="text-danger-text">{copy.checkoutError}</p>}
        <form action={createCheckoutSession}>
          <input type="hidden" name="plan_key" value={plan_key} />
          <input type="hidden" name="interval" value={interval} />
          <button type="submit" className="focus-ring min-h-11 rounded-lg bg-accent px-5 font-semibold text-accent-ink hover:bg-accent-hover">
            {copy.checkoutContinue}
          </button>
        </form>
        <Link href="/premium" className="focus-ring inline-flex min-h-11 items-center rounded-md font-semibold text-accent underline">
          {copy.plansCta}
        </Link>
      </main>
    );
  }

  const { paddleCustomerId } = await getPlanDetails();

  return (
    <main className="page-gutter mx-auto flex min-h-[70dvh] max-w-lg flex-col items-center justify-center gap-6 py-16 text-center">
      <LogoMark className="size-12" />
      <div className="flex flex-col gap-2">
        <p className="app-eyebrow">{APP_NAME}</p>
        <h1 className="text-2xl font-semibold text-text">Paddle naplata</h1>
        <p className="text-ui-sm text-text-2">
          Ako se checkout nije otvorio automatski, vratite se na pakete i
          pokušajte ponovo.
        </p>
      </div>
      <PaddleCheckout customerId={paddleCustomerId} checkout />
      <Link
        href="/premium"
        className="focus-ring rounded-md font-semibold text-accent underline"
      >
        Nazad na pakete
      </Link>
    </main>
  );
}
