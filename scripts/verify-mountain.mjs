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

  const canvas = page.locator("#sim-canvas");
  await canvas.waitFor();

  async function readState(label) {
    const state = await page.evaluate(() => window.__genericalgoidDebug.getState());
    return { label, ...state };
  }

  const before = await readState("before");

  await page.evaluate(() => window.__genericalgoidDebug.simulateMountainClick(0.42, 0.52));
  await page.waitForTimeout(180);

  const afterClick = await readState("afterClick");

  await page.evaluate(() =>
    window.__genericalgoidDebug.simulateMountainDrag(0.24, 0.38, 0.63, 0.7, 260)
  );
  await page.waitForTimeout(260);
  await page.waitForTimeout(180);

  const afterDrag = await readState("afterDrag");

  await page.setViewportSize({ width: 3200, height: 1400 });
  await page.waitForTimeout(280);
  const afterResize = await readState("afterResize");

  assert(afterClick.resetCount === before.resetCount, "H+click triggered a simulation reset.", {
    before,
    afterClick
  });
  assert(
    afterClick.displayModeSwitchCount === before.displayModeSwitchCount,
    "H+click triggered a display-mode rebuild.",
    { before, afterClick }
  );
  assert(
    afterClick.terrainChecksum > before.terrainChecksum,
    "H+click did not increase terrain height.",
    { before, afterClick }
  );
  assert(afterDrag.resetCount === before.resetCount, "H+drag triggered a simulation reset.", {
    before,
    afterDrag
  });
  assert(
    afterDrag.displayModeSwitchCount === before.displayModeSwitchCount,
    "H+drag triggered a display-mode rebuild.",
    { before, afterDrag }
  );
  assert(
    afterDrag.terrainChecksum > afterClick.terrainChecksum,
    "H+drag did not continue raising terrain.",
    { before, afterClick, afterDrag }
  );
  assert(
    afterResize.displayModeSwitchCount === before.displayModeSwitchCount + 1,
    "Viewport resize did not trigger the expected display-mode rebuild.",
    { before, afterDrag, afterResize }
  );
  assert(afterResize.resetCount === before.resetCount, "Viewport resize triggered a full reset.", {
    before,
    afterResize
  });
  assert(
    Math.abs(afterResize.terrainChecksum - afterDrag.terrainChecksum) < 0.01,
    "Terrain edits were lost across the display-mode rebuild.",
    { before, afterDrag, afterResize }
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        before,
        afterClick,
        afterDrag,
        afterResize
      },
      null,
      2
    )
  );
} finally {
  await browser.close();
}
