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
  const box = await canvas.boundingBox();
  assert(box, "Canvas bounding box unavailable.");

  const interactionPoint = {
    x: box.x + box.width * 0.4,
    y: box.y + box.height * 0.4
  };

  async function state(label) {
    const value = await page.evaluate(() => window.__genericalgoidDebug.getState());
    return { label, ...value };
  }

  async function blurActiveElement() {
    await page.evaluate(() => document.activeElement?.blur?.());
  }

  async function holdKeyClick(key, point) {
    await page.keyboard.down(key);
    await page.mouse.click(point.x, point.y);
    await page.keyboard.up(key);
    await page.waitForTimeout(220);
  }

  async function readCurrentCommandDuringKey(key) {
    await page.keyboard.down(key);
    const during = await state(`during-${key}`);
    await page.keyboard.up(key);
    return during;
  }

  async function dispatchComposingKey(targetSelector, code, key) {
    return page.evaluate(({ targetSelector, code, key }) => {
      const target =
        targetSelector === "body"
          ? document.body
          : document.querySelector(targetSelector);
      target?.focus?.();
      const event = new KeyboardEvent("keydown", {
        code,
        key,
        bubbles: true,
        cancelable: true
      });
      Object.defineProperty(event, "isComposing", { configurable: true, value: true });
      target.dispatchEvent(event);
      const state = window.__genericalgoidDebug.getState();
      const keyUp = new KeyboardEvent("keyup", {
        code,
        key,
        bubbles: true,
        cancelable: true
      });
      Object.defineProperty(keyUp, "isComposing", { configurable: true, value: true });
      target.dispatchEvent(keyUp);
      return state;
    }, { targetSelector, code, key });
  }

  await blurActiveElement();
  const beforeFeed = await state("beforeFeed");
  const duringFeed = await readCurrentCommandDuringKey("KeyP");
  await holdKeyClick("KeyP", interactionPoint);
  const afterFeed = await state("afterFeed");

  await page.locator("#quick-total-material-input").click();
  const focusedInput = await state("focusedInput");
  const duringFeedFromInput = await readCurrentCommandDuringKey("KeyP");
  await holdKeyClick("KeyP", interactionPoint);
  const afterFeedFromInput = await state("afterFeedFromInput");

  await page.locator("#quick-population-input").click();
  const focusedPopulationInput = await state("focusedPopulationInput");
  const duringMountainFromInput = await readCurrentCommandDuringKey("KeyH");
  await holdKeyClick("KeyH", interactionPoint);
  const afterMountainFromInput = await state("afterMountainFromInput");

  await blurActiveElement();
  const composingOnBody = await dispatchComposingKey("body", "KeyP", "p");
  const composingOnInput = await dispatchComposingKey("#quick-total-material-input", "KeyP", "p");

  assert(duringFeed.currentCommand === "feed", "P key was not armed from body focus.", {
    beforeFeed,
    duringFeed
  });
  assert(afterFeed.totalMaterial > beforeFeed.totalMaterial, "P+click failed from body focus.", {
    beforeFeed,
    afterFeed
  });

  assert(
    focusedInput.activeElementId === "quick-total-material-input",
    "Quick total material input did not receive focus.",
    { focusedInput }
  );
  assert(
    duringFeedFromInput.currentCommand === "feed",
    "P key was not armed while a numeric input was focused.",
    { focusedInput, duringFeedFromInput }
  );
  assert(
    afterFeedFromInput.totalMaterial > afterFeed.totalMaterial,
    "P+click failed while a numeric input was focused.",
    { afterFeed, afterFeedFromInput }
  );

  assert(
    focusedPopulationInput.activeElementId === "quick-population-input",
    "Quick population input did not receive focus.",
    { focusedPopulationInput }
  );
  assert(
    duringMountainFromInput.currentCommand === "mountain",
    "H key was not armed while a numeric input was focused.",
    { focusedPopulationInput, duringMountainFromInput }
  );
  assert(
    afterMountainFromInput.terrainChecksum > afterFeedFromInput.terrainChecksum,
    "H+click failed while a numeric input was focused.",
    { afterFeedFromInput, afterMountainFromInput }
  );

  assert(
    composingOnBody.currentCommand === "feed",
    "Composing key events on the page body should still arm commands.",
    { composingOnBody }
  );
  assert(
    composingOnInput.currentCommand === null,
    "Composing key events inside editable inputs should not arm commands.",
    { composingOnInput }
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        beforeFeed,
        duringFeed,
        afterFeed,
        focusedInput,
        duringFeedFromInput,
        afterFeedFromInput,
        focusedPopulationInput,
        duringMountainFromInput,
        afterMountainFromInput,
        composingOnBody,
        composingOnInput
      },
      null,
      2
    )
  );
} finally {
  await browser.close();
}
