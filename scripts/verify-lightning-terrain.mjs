import { chromium } from "playwright-core";

const APP_URL = "http://127.0.0.1:4173/";
const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

function assert(condition, message, details = {}) {
  if (!condition) {
    const error = new Error(message);
    error.details = details;
    throw error;
  }
}

const browser = await chromium.launch({
  executablePath: CHROME_PATH,
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"]
});

try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof window.__genericalgoidDebug?.getState === "function");
  await page.waitForTimeout(400);

  const before = await page.evaluate(() => window.__genericalgoidDebug.getState());
  const afterRaise = await page.evaluate(() => {
    window.__genericalgoidDebug.simulateMountainClick(0.46, 0.52);
    window.__genericalgoidDebug.simulateMountainDrag(0.42, 0.5, 0.55, 0.56, 320);
    return window.__genericalgoidDebug.getState();
  });
  const lightning = await page.evaluate(() =>
    window.__genericalgoidDebug.simulateLightningBurst(0.5, 0.54, 0.1)
  );
  const afterLightning = lightning.state;

  assert(afterRaise.terrainChecksum > before.terrainChecksum, "Mountain setup did not increase terrain.", {
    before,
    afterRaise
  });
  assert(lightning.terrainChanged === true, "Lightning did not report terrain erosion.", {
    lightning
  });
  assert(
    afterLightning.terrainChecksum < afterRaise.terrainChecksum,
    "Terrain checksum did not decrease after lightning.",
    {
      before,
      afterRaise,
      lightning,
      afterLightning
    }
  );
  assert(
    afterLightning.terrainVersion > afterRaise.terrainVersion,
    "Terrain version did not advance after lightning erosion.",
    {
      afterRaise,
      afterLightning
    }
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        before,
        afterRaise,
        lightning,
        afterLightning
      },
      null,
      2
    )
  );
} finally {
  await browser.close();
}
