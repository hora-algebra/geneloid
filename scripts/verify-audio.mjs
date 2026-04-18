import { chromium } from "playwright-core";

const APP_URL = process.env.APP_URL ?? "http://127.0.0.1:4173/";
const CHROME_PATH =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

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
  await page.addInitScript(() => {
    const keys = [
      "genericalgoid.audio.enabled",
      "genericalgoid.audio.bgm.enabled",
      "genericalgoid.audio.sfx.enabled",
      "genericalgoid.audio.volume",
      "genericalgoid.audio.bgm.volume",
      "genericalgoid.audio.sfx.volume",
      "genericalgoid.fast-mode"
    ];
    for (const key of keys) {
      window.localStorage.removeItem(key);
    }
  });

  await page.goto(APP_URL, { waitUntil: "networkidle" });
  await page.waitForFunction(() => typeof window.__genericalgoidDebug?.getState === "function");

  const canvas = page.locator("#sim-canvas");
  await canvas.waitFor();
  const canvasBox = await canvas.boundingBox();
  assert(canvasBox, "Simulation canvas is not visible.");

  async function state() {
    return page.evaluate(() => window.__genericalgoidDebug.getState());
  }

  async function clickCanvas(xRatio, yRatio) {
    const x = canvasBox.x + canvasBox.width * xRatio;
    const y = canvasBox.y + canvasBox.height * yRatio;
    await page.mouse.click(x, y);
  }

  async function holdKeyClick(key, xRatio, yRatio, holdMs = 0) {
    const x = canvasBox.x + canvasBox.width * xRatio;
    const y = canvasBox.y + canvasBox.height * yRatio;
    await page.keyboard.down(key);
    await page.mouse.move(x, y);
    await page.mouse.down();
    if (holdMs > 0) {
      await page.waitForTimeout(holdMs);
    }
    await page.mouse.up();
    await page.keyboard.up(key);
  }

  const before = await state();

  await clickCanvas(0.5, 0.5);
  await page.waitForFunction(() => {
    const audio = window.__genericalgoidDebug.getState().audio;
    return audio?.primed && audio?.contextState === "running";
  });
  await page.waitForFunction(() => {
    const audio = window.__genericalgoidDebug.getState().audio;
    return audio?.hasBgmElement && !audio?.bgmFailed && (audio?.bgmReadyState ?? 0) >= 2;
  });
  await page.waitForTimeout(1200);

  const afterPrime = await state();
  await page.waitForTimeout(1200);
  const afterBgmAdvance = await state();

  await holdKeyClick("p", 0.12, 0.18);
  await page.waitForTimeout(220);
  const afterFeed = await state();

  await holdKeyClick("s", 0.18, 0.24);
  await page.waitForTimeout(260);
  const afterSpring = await state();

  await holdKeyClick("l", 0.52, 0.42, 420);
  await page.waitForTimeout(260);
  const afterLightning = await state();

  assert(before.audio?.available === true, "Audio API is not available in the browser.", {
    before
  });
  assert(afterPrime.audio?.hasContext, "AudioContext was not created after user gesture.", {
    afterPrime
  });
  assert(afterPrime.audio?.primed, "Audio system did not prime after pointer interaction.", {
    afterPrime
  });
  assert(afterPrime.audio?.contextState === "running", "AudioContext is not running.", {
    afterPrime
  });
  assert(afterPrime.audio?.bgmFailed === false, "BGM asset failed to load.", {
    afterPrime
  });
  assert(afterPrime.audio?.hasBgmElement === true, "BGM element was not created.", {
    afterPrime
  });
  assert(
    (afterBgmAdvance.audio?.bgmCurrentTime ?? 0) > (afterPrime.audio?.bgmCurrentTime ?? 0) + 0.6,
    "BGM currentTime did not advance, so music is not actually playing.",
    { afterPrime, afterBgmAdvance }
  );
  assert(
    (afterFeed.audio?.sfxCounts?.feeding ?? 0) > (afterPrime.audio?.sfxCounts?.feeding ?? 0),
    "Feeding SFX did not fire.",
    { afterPrime, afterFeed }
  );
  assert(
    (afterSpring.audio?.sfxCounts?.springPlaced ?? 0) >
      (afterFeed.audio?.sfxCounts?.springPlaced ?? 0),
    "Spring placement SFX did not fire.",
    { afterFeed, afterSpring }
  );
  assert(
    (afterLightning.audio?.sfxCounts?.lightning ?? 0) >
      (afterSpring.audio?.sfxCounts?.lightning ?? 0),
    "Lightning SFX did not fire.",
    { afterSpring, afterLightning }
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        url: APP_URL,
        before,
        afterPrime,
        afterBgmAdvance,
        afterFeed,
        afterSpring,
        afterLightning
      },
      null,
      2
    )
  );
} finally {
  await browser.close();
}
