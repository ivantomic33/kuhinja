/// <reference types="@serwist/next/typings" />

declare global {
  interface Window {
    // Populated by @serwist/next when register is enabled
    serwist?: import("@serwist/window").Serwist;
  }
}

export {};
