/**
 * Fails when public/manifest.json icon versions drift from lib/config/pwa-icons.json.
 * Icon URLs are cache-busted (`-vN`) and served with a one-year immutable header.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const configPath = join(rootDir, "lib", "config", "pwa-icons.json");
const manifestPath = join(rootDir, "public", "manifest.json");

const VERSION_RE = /-v(\d+)\.(?:svg|png)$/;

function extractVersion(url) {
  const match = String(url).match(VERSION_RE);
  if (!match) {
    throw new Error(`Icon path must include a cache-busting version (got ${url})`);
  }
  return match[1];
}

function uniqueVersions(urls, label) {
  const versions = [...new Set(urls.map(extractVersion))];
  if (versions.length !== 1) {
    throw new Error(`${label} must use one icon version, found: ${versions.join(", ")}`);
  }
  return versions[0];
}

const icons = JSON.parse(readFileSync(configPath, "utf8"));
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

if (!Array.isArray(manifest.icons) || manifest.icons.length === 0) {
  throw new Error("public/manifest.json has no icons entries");
}

const configVersion = uniqueVersions(Object.values(icons), "lib/config/pwa-icons.json");
const manifestVersion = uniqueVersions(
  manifest.icons.map((icon) => icon.src),
  "public/manifest.json",
);

if (configVersion !== manifestVersion) {
  console.error(
    `PWA icon version mismatch: lib/config/pwa-icons.json=v${configVersion}, public/manifest.json=v${manifestVersion}`,
  );
  process.exit(1);
}

const expected = new Set([icons.png192, icons.png512]);
const actual = new Set(manifest.icons.map((icon) => icon.src));
const missing = [...expected].filter((url) => !actual.has(url));
const extra = [...actual].filter((url) => !expected.has(url));

if (missing.length > 0 || extra.length > 0) {
  console.error("public/manifest.json icon paths do not match lib/config/pwa-icons.json");
  if (missing.length > 0) console.error(`  missing: ${missing.join(", ")}`);
  if (extra.length > 0) console.error(`  extra: ${extra.join(", ")}`);
  process.exit(1);
}

console.log(`PWA icon versions match (v${configVersion})`);
