/** Builds the versioned SVG favicon and PWA icons from the TreuPlate mark. */
import { deflateSync } from "node:zlib";
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { brandMark } from "../components/brand/mark.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const configPath = join(rootDir, "lib", "config", "pwa-icons.json");
const manifestPath = join(rootDir, "public", "manifest.json");
const outDir = join(rootDir, "public", "icons");

const VERSION_RE = /-v(\d+)\.(?:svg|png)$/;

function extractVersion(url) {
  const match = String(url).match(VERSION_RE);
  if (!match) {
    throw new Error(`Icon path must include a cache-busting version (got ${url})`);
  }
  return match[1];
}

function pathsForVersion(version) {
  return {
    svg: `/icons/icon-v${version}.svg`,
    png192: `/icons/icon-192-v${version}.png`,
    png512: `/icons/icon-512-v${version}.png`,
  };
}

function assertSingleVersion(urls, label) {
  const versions = [...new Set(urls.map(extractVersion))];
  if (versions.length !== 1) {
    throw new Error(`${label} must use one icon version, found: ${versions.join(", ")}`);
  }
  return versions[0];
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

let icons = JSON.parse(readFileSync(configPath, "utf8"));
const versionArg = process.argv[2];
if (versionArg !== undefined) {
  const version = String(versionArg).replace(/^v/i, "");
  if (!/^\d+$/.test(version)) {
    throw new Error(`Invalid icon version "${versionArg}". Use a number like 3 or v3.`);
  }
  icons = pathsForVersion(version);
}

assertSingleVersion(Object.values(icons), "lib/config/pwa-icons.json");

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const { name } = manifest;

function hexRgb(hex) {
  return [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
}

const background = hexRgb(brandMark.background);
const accent = hexRgb(brandMark.accent);

function crcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
}

const CRC_TABLE = crcTable();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcBuf), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(size, rgba) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    rgba.copy(raw, row + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function tokenizePath(d) {
  return d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];
}

function arcPoints(x1, y1, rx, ry, phiDeg, large, sweep, x2, y2) {
  if (x1 === x2 && y1 === y2) return [];
  const phi = (phiDeg * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  let rxAbs = Math.abs(rx);
  let ryAbs = Math.abs(ry);
  if (rxAbs < 1e-6 || ryAbs < 1e-6) return [[x2, y2]];

  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cos * dx + sin * dy;
  const y1p = -sin * dx + cos * dy;
  const lam = (x1p * x1p) / (rxAbs * rxAbs) + (y1p * y1p) / (ryAbs * ryAbs);
  if (lam > 1) {
    const s = Math.sqrt(lam);
    rxAbs *= s;
    ryAbs *= s;
  }
  const num = Math.max(
    0,
    rxAbs * rxAbs * ryAbs * ryAbs -
      rxAbs * rxAbs * y1p * y1p -
      ryAbs * ryAbs * x1p * x1p
  );
  const den = rxAbs * rxAbs * y1p * y1p + ryAbs * ryAbs * x1p * x1p;
  const coef = (large === sweep ? -1 : 1) * Math.sqrt(den === 0 ? 0 : num / den);
  const cxp = coef * ((rxAbs * y1p) / ryAbs);
  const cyp = coef * (-(ryAbs * x1p) / rxAbs);
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2;
  const cy = sin * cxp + cos * cyp + (y1 + y2) / 2;

  function angle(ux, uy, vx, vy) {
    const dot = ux * vx + uy * vy;
    const ul = Math.hypot(ux, uy) * Math.hypot(vx, vy);
    let ang = Math.acos(Math.min(1, Math.max(-1, ul === 0 ? 1 : dot / ul)));
    if (ux * vy - uy * vx < 0) ang = -ang;
    return ang;
  }

  const theta1 = angle(1, 0, (x1p - cxp) / rxAbs, (y1p - cyp) / ryAbs);
  let dTheta = angle(
    (x1p - cxp) / rxAbs,
    (y1p - cyp) / ryAbs,
    (-x1p - cxp) / rxAbs,
    (-y1p - cyp) / ryAbs
  );
  if (!sweep && dTheta > 0) dTheta -= Math.PI * 2;
  if (sweep && dTheta < 0) dTheta += Math.PI * 2;

  const steps = Math.max(8, Math.ceil(Math.abs(dTheta) / (Math.PI / 18)));
  const pts = [];
  for (let i = 1; i <= steps; i += 1) {
    const t = theta1 + (dTheta * i) / steps;
    const ct = Math.cos(t);
    const st = Math.sin(t);
    pts.push([
      cx + rxAbs * ct * cos - ryAbs * st * sin,
      cy + rxAbs * ct * sin + ryAbs * st * cos,
    ]);
  }
  return pts;
}

function pathToContours(d) {
  const tokens = tokenizePath(d);
  const contours = [];
  let current = [];
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  let i = 0;
  let cmd = "";

  function pushContour() {
    if (current.length > 1) contours.push(current);
    current = [];
  }

  function lineTo(x, y) {
    current.push([x, y]);
    cx = x;
    cy = y;
  }

  function moveTo(x, y) {
    pushContour();
    current = [[x, y]];
    cx = x;
    cy = y;
    sx = x;
    sy = y;
  }

  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) {
      cmd = tokens[i];
      i += 1;
    }
    const rel = cmd === cmd.toLowerCase();
    const op = cmd.toUpperCase();
    if (op === "Z") {
      if (current.length) {
        current.push([sx, sy]);
        pushContour();
      }
      cx = sx;
      cy = sy;
      continue;
    }
    if (op === "M") {
      const x = (rel ? cx : 0) + Number(tokens[i]);
      const y = (rel ? cy : 0) + Number(tokens[i + 1]);
      i += 2;
      moveTo(x, y);
      cmd = rel ? "l" : "L";
      continue;
    }
    if (op === "L") {
      const x = (rel ? cx : 0) + Number(tokens[i]);
      const y = (rel ? cy : 0) + Number(tokens[i + 1]);
      i += 2;
      lineTo(x, y);
      continue;
    }
    if (op === "H") {
      const x = (rel ? cx : 0) + Number(tokens[i]);
      i += 1;
      lineTo(x, cy);
      continue;
    }
    if (op === "V") {
      const y = (rel ? cy : 0) + Number(tokens[i]);
      i += 1;
      lineTo(cx, y);
      continue;
    }
    if (op === "A") {
      const rx = Number(tokens[i]);
      const ry = Number(tokens[i + 1]);
      const rot = Number(tokens[i + 2]);
      const large = Number(tokens[i + 3]) ? 1 : 0;
      const sweep = Number(tokens[i + 4]) ? 1 : 0;
      const x = (rel ? cx : 0) + Number(tokens[i + 5]);
      const y = (rel ? cy : 0) + Number(tokens[i + 6]);
      i += 7;
      const pts = arcPoints(cx, cy, rx, ry, rot, large, sweep, x, y);
      for (const pt of pts) lineTo(pt[0], pt[1]);
      continue;
    }
    throw new Error(`Unsupported path command ${cmd}`);
  }
  pushContour();
  return contours;
}

function fillContours(size, contours, transform) {
  const mask = new Uint8Array(size * size);
  const mapped = contours.map((contour) =>
    contour.map(([x, y]) => {
      const p = transform(x, y);
      return [p[0], p[1]];
    })
  );

  for (let y = 0; y < size; y += 1) {
    const scanY = y + 0.5;
    const hits = [];
    for (const contour of mapped) {
      for (let i = 0; i < contour.length - 1; i += 1) {
        const [x1, y1] = contour[i];
        const [x2, y2] = contour[i + 1];
        if ((y1 <= scanY && y2 > scanY) || (y2 <= scanY && y1 > scanY)) {
          const t = (scanY - y1) / (y2 - y1);
          hits.push({ x: x1 + t * (x2 - x1), dir: y2 > y1 ? 1 : -1 });
        }
      }
    }
    hits.sort((a, b) => a.x - b.x);
    let wind = 0;
    let prev = 0;
    for (const hit of hits) {
      if (wind !== 0) {
        const x0 = Math.max(0, Math.ceil(prev));
        const x1 = Math.min(size, Math.floor(hit.x));
        const row = y * size;
        for (let x = x0; x < x1; x += 1) mask[row + x] = 1;
      }
      wind += hit.dir;
      prev = hit.x;
    }
  }
  return mask;
}

function setPx(buf, size, x, y, r, g, b, a = 255) {
  const i = (y * size + x) * 4;
  buf[i] = r;
  buf[i + 1] = g;
  buf[i + 2] = b;
  buf[i + 3] = a;
}

function insideRoundRect(px, py, x, y, w, h, rad) {
  const cx = Math.min(Math.max(px, x + rad), x + w - rad);
  const cy = Math.min(Math.max(py, y + rad), y + h - rad);
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy <= rad * rad;
}

function render(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const scale = size / brandMark.size;
  const { x, y, width, height, rx } = brandMark.tile;
  const mask = fillContours(size, pathToContours(brandMark.glyph), (x, y) => [
    x * scale, y * scale,
  ]);
  const tile = [x, y, width, height, rx].map((value) => value * scale);

  let markPixels = 0;
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      const ink = mask[row * size + column];
      if (ink) markPixels += 1;
      const onTile = insideRoundRect(column + 0.5, row + 0.5, ...tile);
      // The opaque background extends to the edges for maskable launchers.
      const color = !ink && onTile ? accent : background;
      setPx(rgba, size, column, row, ...color);
    }
  }

  return { rgba, markPixels };
}

function downsample(src, srcSize, dstSize) {
  const dst = Buffer.alloc(dstSize * dstSize * 4);
  const scale = srcSize / dstSize;
  for (let y = 0; y < dstSize; y += 1) {
    const y0 = Math.floor(y * scale);
    const y1 = Math.floor((y + 1) * scale);
    for (let x = 0; x < dstSize; x += 1) {
      const x0 = Math.floor(x * scale);
      const x1 = Math.floor((x + 1) * scale);
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let n = 0;
      for (let yy = y0; yy < y1; yy += 1) {
        for (let xx = x0; xx < x1; xx += 1) {
          const i = (yy * srcSize + xx) * 4;
          r += src[i];
          g += src[i + 1];
          b += src[i + 2];
          a += src[i + 3];
          n += 1;
        }
      }
      const j = (y * dstSize + x) * 4;
      dst[j] = Math.round(r / n);
      dst[j + 1] = Math.round(g / n);
      dst[j + 2] = Math.round(b / n);
      dst[j + 3] = Math.round(a / n);
    }
  }
  return dst;
}

const HI = 1536;
const { rgba, markPixels } = render(HI);
if (markPixels < HI * HI * 0.02) {
  throw new Error(`Mark raster failed, only ${markPixels} pixels`);
}

mkdirSync(outDir, { recursive: true });
for (const [size, url] of [[192, icons.png192], [512, icons.png512]]) {
  const file = join(outDir, basename(url));
  writeFileSync(file, encodePng(size, downsample(rgba, HI, size)));
  console.log(`Wrote ${file}`);
}

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${brandMark.size} ${brandMark.size}" role="img" aria-label="${name}">
  <rect width="${brandMark.size}" height="${brandMark.size}" rx="${brandMark.radius}" fill="${brandMark.background}"/>
  <rect x="${brandMark.tile.x}" y="${brandMark.tile.y}" width="${brandMark.tile.width}" height="${brandMark.tile.height}" rx="${brandMark.tile.rx}" fill="${brandMark.accent}"/>
  <path d="${brandMark.glyph}" fill="${brandMark.background}"/>
</svg>
`;
const vectorPath = join(rootDir, "components", "brand", "treuplate.svg");
writeFileSync(vectorPath, svg);
writeFileSync(join(outDir, basename(icons.svg)), svg);
console.log(`Wrote ${vectorPath} and ${icons.svg}`);

manifest.icons = [
  {
    src: icons.png192,
    sizes: "192x192",
    type: "image/png",
    purpose: "any",
  },
  {
    src: icons.png192,
    sizes: "192x192",
    type: "image/png",
    purpose: "maskable",
  },
  {
    src: icons.png512,
    sizes: "512x512",
    type: "image/png",
    purpose: "any",
  },
  {
    src: icons.png512,
    sizes: "512x512",
    type: "image/png",
    purpose: "maskable",
  },
];
writeJson(configPath, icons);
writeJson(manifestPath, manifest);
console.log(`Updated ${manifestPath}`);

const keep = new Set([
  basename(icons.svg),
  basename(icons.png192),
  basename(icons.png512),
]);
for (const file of readdirSync(outDir)) {
  if (keep.has(file) || !/^icon(?:-(?:192|512))?-v\d+\.(?:svg|png)$/.test(file)) continue;
  unlinkSync(join(outDir, file));
  console.log(`Removed stale ${file}`);
}

console.log(`mark pixels ${markPixels}`);
