export type LandingCtaLocation = "hero" | "pricing" | "footer" | "mobile_sticky";

type LandingEvents = {
  landing_cta_click: { location: LandingCtaLocation };
  landing_pricing_toggle: { interval: "monthly" | "yearly" };
};

export function trackAnalytics<Event extends keyof LandingEvents>(
  ...args: [event: Event, payload: LandingEvents[Event]]
) {
  // There is no analytics provider configured.
  void args;
}
