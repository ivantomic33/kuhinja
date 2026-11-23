import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { LogoMark } from "@/components/brand/LogoMark";
import { tokens } from "@/lib/design/tokens";
import { sr } from "@/lib/i18n/sr";
import { openGraphCard, socialCardSize } from "@/lib/seo/social-card";

export const alt = openGraphCard.alt;
export const size = socialCardSize;
export const contentType = "image/png";

const fontFiles = ["inter-latin-700-normal.woff", "inter-latin-ext-700-normal.woff"];

export default async function OpenGraphImage() {
  const fonts = await Promise.all(fontFiles.map(async (file) => ({
    name: "Inter",
    data: await readFile(join(process.cwd(), "assets", "fonts", file)),
    style: "normal" as const,
    weight: 700 as const,
  })));

  return new ImageResponse(
    (
      <div style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 48,
        padding: 72,
        background: tokens.bg,
        fontFamily: "Inter",
        fontWeight: 700,
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 640 }}>
          <div style={{ display: "flex", color: tokens.text, fontSize: 96, letterSpacing: -4 }}>
            {sr.app.name}
          </div>
          <div style={{ display: "flex", width: 72, height: 6, borderRadius: 3, background: tokens.accent }} />
          <div style={{ display: "flex", color: tokens.text2, fontSize: 36, lineHeight: 1.3, maxWidth: 560 }}>
            {sr.app.description}
          </div>
        </div>
        <LogoMark size={324} />
      </div>
    ),
    { ...size, fonts }
  );
}
