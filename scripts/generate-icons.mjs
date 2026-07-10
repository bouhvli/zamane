// One-time dev tool: renders the Zamane monogram (violet square, white "Z"
// in Oi, matching the design system's existing "Monogram" logo variant) and
// screenshots it at the sizes vite-plugin-pwa's manifest needs. No image
// rasterization library is installed, so this uses a headless browser
// instead. Run with `npm run generate-icons`.
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const sourceUrl = pathToFileURL(join(__dirname, "icon-source.html")).href;
const outDir = join(__dirname, "..", "public", "icons");
mkdirSync(outDir, { recursive: true });

const targets = [
  { file: "icon-192.png", size: 192, maskable: false },
  { file: "icon-512.png", size: 512, maskable: false },
  { file: "icon-512-maskable.png", size: 512, maskable: true },
];

const browser = await chromium.launch();
try {
  for (const { file, size, maskable } of targets) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.goto(maskable ? `${sourceUrl}?maskable` : sourceUrl, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: join(outDir, file) });
    await page.close();
    console.log(`Wrote public/icons/${file} (${size}x${size})`);
  }
} finally {
  await browser.close();
}
