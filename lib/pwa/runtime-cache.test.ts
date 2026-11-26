import { CacheFirst, NetworkFirst, NetworkOnly, type RouteMatchCallbackOptions, type RuntimeCaching } from "serwist";
import { afterAll, beforeAll, expect, it, vi } from "vitest";

const { setup } = vi.hoisted(() => ({ setup: vi.fn() }));

vi.mock("serwist", async (importOriginal) => ({
  ...await importOriginal<typeof import("serwist")>(),
  Serwist: class {
    constructor(options: { runtimeCaching: RuntimeCaching[] }) {
      setup(options.runtimeCaching);
    }
    addEventListeners() {}
  },
}));

beforeAll(async () => {
  vi.stubGlobal("self", { addEventListener: vi.fn() });
  // The worker is compiled separately from the DOM app's TypeScript project.
  const workerModule = "../../app/sw";
  await import(workerModule);
});

afterAll(() => vi.unstubAllGlobals());

function strategy(href: string, mode: RequestMode = "navigate") {
  const url = new URL(href, "https://treuplate.test");
  const options: RouteMatchCallbackOptions = {
    url,
    sameOrigin: url.origin === "https://treuplate.test",
    request: { mode, destination: mode === "navigate" ? "document" : "" } as Request,
    event: {} as RouteMatchCallbackOptions["event"],
  };
  const [routes]: [RuntimeCaching[]] = setup.mock.calls[0] as [RuntimeCaching[]];
  return routes.find(({ matcher }) => typeof matcher === "function"
    ? matcher(options)
    : matcher instanceof RegExp && matcher.test(url.href))?.handler;
}

it.each(["/", "/kako-poceti", "/faq"])("refreshes public HTML at %s from the network first", (path) => {
  expect(strategy(path)).toBeInstanceOf(NetworkFirst);
});

it.each(["/premium", "/checkout", "/welcome", "/otpad", "/purchase-orders/123", "/invite/secret", "/r/secret", "/unlisted"])(
  "keeps session-sensitive and unlisted HTML at %s out of runtime caches",
  (path) => expect(strategy(path)).toBeInstanceOf(NetworkOnly),
);

it("caches hashed Next assets and bypasses both app and Supabase APIs", () => {
  expect(strategy("/_next/static/chunks/main-123.js", "cors")).toBeInstanceOf(CacheFirst);
  expect(strategy("/api/versioned-update", "cors")).toBeInstanceOf(NetworkOnly);
  expect(strategy("https://example.supabase.co/rest/v1/recipes", "cors")).toBeInstanceOf(NetworkOnly);
});
