import "server-only";
import { Environment, Paddle } from "@paddle/paddle-node-sdk";
import { getPaddleConfig } from "./config";

let instance: Paddle | undefined;

export function paddleSdk() {
  if (!instance) {
    const config = getPaddleConfig();
    instance = new Paddle(config.PADDLE_API_KEY, {
      environment: config.NEXT_PUBLIC_PADDLE_ENVIRONMENT === "sandbox" ? Environment.sandbox : Environment.production,
    });
  }
  return instance;
}
