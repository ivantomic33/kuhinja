import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const files = [
  [
    "inter-latin-700-normal.woff",
    "https://cdn.jsdelivr.net/fontsource/fonts/inter@5.2.5/latin-700-normal.woff",
  ],
  [
    "inter-latin-ext-700-normal.woff",
    "https://cdn.jsdelivr.net/fontsource/fonts/inter@5.2.5/latin-ext-700-normal.woff",
  ],
];

const dir = join(process.cwd(), "assets", "fonts");
await mkdir(dir, { recursive: true });

for (const [name, url] of files) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 1000) {
    throw new Error(`${name} looks invalid (${bytes.length} bytes)`);
  }
  await writeFile(join(dir, name), bytes);
  console.log(`${name} ${bytes.length}`);
}
