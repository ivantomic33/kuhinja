import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { sr } from "@/lib/i18n/sr";

export const alt = sr.marketing.ogAlt;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const FONT_FILES = [
  "inter-latin-700-normal.woff",
  "inter-latin-ext-700-normal.woff",
] as const;

/** Local Inter files. No CDN fetch while generating share images. */
async function loadFonts() {
  const directories = [
    join(process.cwd(), "assets", "fonts"),
    join(process.cwd(), "node_modules", "@fontsource", "inter", "files"),
  ];

  for (const dir of directories) {
    try {
      const [latin, latinExt] = await Promise.all(
        FONT_FILES.map((file) => readFile(join(dir, file)))
      );
      return [
        { name: "Inter", data: latin, style: "normal" as const, weight: 700 as const },
        { name: "Inter", data: latinExt, style: "normal" as const, weight: 700 as const },
      ];
    } catch {
      // Try the next local directory.
    }
  }

  return undefined;
}

export default async function OpenGraphImage() {
  const fonts = await loadFonts();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0B0B0E",
          padding: 64,
          fontFamily: fonts ? "Inter" : "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            color: "#FF6B35",
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: -0.5,
          }}
        >
          {sr.app.name}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              display: "flex",
              color: "#F5F5F7",
              fontSize: 64,
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: -1.5,
              maxWidth: 980,
            }}
          >
            {sr.marketing.heroTitle}
          </div>
          <div
            style={{
              display: "flex",
              color: "#8E8E9A",
              fontSize: 28,
              lineHeight: 1.35,
              maxWidth: 860,
            }}
          >
            {sr.marketing.heroSubtitle}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                background: "#141418",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 16,
                padding: "16px 20px",
                color: "#F5F5F7",
                fontSize: 24,
                fontWeight: 600,
              }}
            >
              {sr.recipes.foodCost.foodCostPercent}: 13.6%
            </div>
            <div
              style={{
                display: "flex",
                background: "rgba(255,107,53,0.15)",
                border: "1px solid rgba(255,107,53,0.35)",
                borderRadius: 16,
                padding: "16px 20px",
                color: "#FF6B35",
                fontSize: 24,
                fontWeight: 600,
              }}
            >
              {sr.marketing.freeName}
            </div>
          </div>
          <div style={{ display: "flex", color: "#8E8E9A", fontSize: 22 }}>
            {sr.app.description}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts,
    }
  );
}
