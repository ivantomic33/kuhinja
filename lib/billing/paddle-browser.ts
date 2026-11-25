"use client";

import {
  initializePaddle,
  type Paddle,
  type CheckoutOpenOptions,
  type PricePreviewParams,
  type PricePreviewResponse,
  type Environments,
} from "@paddle/paddle-js";

export type PaddlePublicEnvironment = "sandbox" | "live";

let paddlePromise: Promise<Paddle> | null = null;

function readPublicPaddleConfig(): {
  environment: PaddlePublicEnvironment;
  token: string;
  paddleEnvironment: Environments;
} {
  const environment = process.env.NEXT_PUBLIC_PADDLE_ENVIRONMENT?.trim();
  const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN?.trim();

  if (environment !== "sandbox" && environment !== "live") {
    throw new Error(
      'NEXT_PUBLIC_PADDLE_ENVIRONMENT must be set to "sandbox" or "live" (no silent default).',
    );
  }
  if (!token) {
    throw new Error(
      "NEXT_PUBLIC_PADDLE_CLIENT_TOKEN is not set. Add a Paddle client-side token (test_… for sandbox).",
    );
  }
  if (environment === "sandbox" && !token.startsWith("test_")) {
    throw new Error(
      "Sandbox requires a client token prefixed with test_. Refusing to initialize Paddle.",
    );
  }
  if (environment === "live" && !token.startsWith("live_")) {
    throw new Error(
      "Live requires a client token prefixed with live_. Refusing to initialize Paddle.",
    );
  }

  // @paddle/paddle-js uses "production" for the live Billing environment.
  const paddleEnvironment: Environments =
    environment === "sandbox" ? "sandbox" : "production";

  return { environment, token, paddleEnvironment };
}

/**
 * Lazy singleton Paddle.js instance for the browser.
 * Fails loudly when env/token are missing or mismatched.
 */
export function getBrowserPaddle(): Promise<Paddle> {
  if (!paddlePromise) {
    paddlePromise = (async () => {
      const { token, paddleEnvironment } = readPublicPaddleConfig();
      const paddle = await initializePaddle({
        token,
        environment: paddleEnvironment,
        checkout: {
          settings: {
            displayMode: "overlay",
            variant: "one-page",
            allowLogout: false,
          },
        },
      });
      if (!paddle) {
        throw new Error("Paddle.js failed to initialize.");
      }
      return paddle;
    })().catch((error) => {
      paddlePromise = null;
      throw error;
    });
  }
  return paddlePromise;
}

export async function previewPrices(
  params: PricePreviewParams,
): Promise<PricePreviewResponse> {
  const paddle = await getBrowserPaddle();
  return paddle.PricePreview(params);
}

export async function openOverlayCheckout(
  options: CheckoutOpenOptions,
): Promise<void> {
  const paddle = await getBrowserPaddle();
  paddle.Checkout.open({
    ...options,
    settings: {
      displayMode: "overlay",
      variant: "one-page",
      allowLogout: false,
      ...options.settings,
    },
  });
}

export function checkoutSuccessUrl(origin = typeof window !== "undefined" ? window.location.origin : ""): string {
  return `${origin.replace(/\/$/, "")}/welcome`;
}
