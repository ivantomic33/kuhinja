import { createRequire } from "node:module";
import { realpathSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "vitest/config";

const require = createRequire(path.join(__dirname, "package.json"));
const reactRoot = realpathSync(path.dirname(require.resolve("react/package.json")));
const reactDomRoot = realpathSync(path.dirname(require.resolve("react-dom/package.json")));

export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "tests/**/*.test.ts"],
    server: {
      deps: {
        inline: ["react-dom", "@testing-library/react", "@testing-library/dom"],
      },
    },
    coverage: {
      include: ["lib/calc/**/*.ts"],
      exclude: ["lib/calc/**/*.test.ts"],
      thresholds: { statements: 90, branches: 90, functions: 90, lines: 90 },
    },
  },
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      "@": path.resolve(__dirname, "."),
      "react/jsx-dev-runtime": path.join(reactRoot, "jsx-dev-runtime.js"),
      "react/jsx-runtime": path.join(reactRoot, "jsx-runtime.js"),
      "react-dom/client": path.join(reactDomRoot, "client.js"),
      "react-dom/server": path.join(reactDomRoot, "server.node.js"),
      "react-dom": path.join(reactDomRoot, "index.js"),
      react: path.join(reactRoot, "index.js"),
    },
  },
});
