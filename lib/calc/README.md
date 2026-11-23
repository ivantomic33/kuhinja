# Pricing and scaling calculations

Keep full precision through conversions, unit prices, ingredient costs, and
scaled quantities. Round at the output boundary using the precision that output
requires. Calculator money uses two decimal places, including when applying a
suggested price to the menu. The recipe overview suggests a price to the nearest
10 RSD. Scaler labels use whole grams or milliliters, two decimals for kilograms
and liters, and up to one decimal for spoons, pieces, and packages. Counts of
10 or more pieces or packages display as whole numbers.

Target servings are rounded to a whole serving and clamped to 1–500 before
scaling. Shopping lists and oven schedules round up to whole packages and
cycles from the unrounded quantities.

- Waste must be at least 0% and below 100%. At 100% the entire purchase is
  unusable, so the effective unit price is undefined. Forms reject 100%,
  `effectivePrice` returns `NaN`, and `lineCost` preserves the existing
  zero-cost fallback for invalid stored inputs.
- A unit price requires a positive purchase quantity. `unitPrice` returns
  `null` for zero quantity or a non-finite result. A zero-quantity costing
  line contributes zero.
- An absolute price change is the current price minus the previous price.
  A percentage change requires a positive previous price. It returns
  `null` when the previous price is zero.
- Grams and kilograms share a mass family, and milliliters and liters share a
  volume family. Pieces (`kom`) and packages (`pak`) each convert only to
  themselves.

Run `npm run test:coverage` to check the calculation suite's 90% minimum
for statements, branches, functions, and lines.
