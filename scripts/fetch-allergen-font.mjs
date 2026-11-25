import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Full Noto Sans Regular TTF — latin + latin-ext (č ć š ž đ) for allergen PDFs.
 */
const name = "NotoSans-Regular.ttf";
const urls = [
  "https://cdn.jsdelivr.net/gh/notofonts/noto-fonts@main/hinted/ttf/NotoSans/NotoSans-Regular.ttf",
  "https://raw.githubusercontent.com/notofonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf",
];

const dir = join(process.cwd(), "assets", "fonts");
await mkdir(dir, { recursive: true });

let lastError = null;
for (const url of urls) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      lastError = new Error(`${url} → ${response.status}`);
      continue;
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length < 50_000) {
      lastError = new Error(`${name} looks invalid (${bytes.length} bytes)`);
      continue;
    }
    await writeFile(join(dir, name), bytes);
    console.log(`${name} ${bytes.length} from ${url}`);
    process.exit(0);
  } catch (error) {
    lastError = error;
  }
}

throw lastError ?? new Error("Could not download Noto Sans");
