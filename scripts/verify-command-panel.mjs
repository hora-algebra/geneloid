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

  async function openCommandsPanel() {
    await page.locator("#commands-peek-button").hover();
    await page.waitForFunction(() => {
      const panel = document.getElementById("commands-panel");
      if (!panel) {
        return false;
      }
      const style = getComputedStyle(panel);
      return style.pointerEvents !== "none" && Number.parseFloat(style.opacity || "0") > 0.5;
    });
  }

  async function clickAction(action) {
    await openCommandsPanel();
    await page.locator(`[data-command-action="${action}"]`).click();
    await page.waitForTimeout(450);
  }

  async function activateActionWithKeyboard(action) {
    await openCommandsPanel();
    const card = page.locator(`[data-command-action="${action}"]`);
    await card.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(450);
  }

  const before = await page.evaluate(() => ({
    menuHidden: document.getElementById("menu-layer")?.hidden ?? null,
    status: window.__genericalgoidDebug.getState().statusText,
    resetCount: window.__genericalgoidDebug.getState().resetCount,
    fullscreen: Boolean(document.fullscreenElement),
    url: location.pathname
  }));

  await clickAction("menu");
  const afterMenuOpen = await page.evaluate(() => ({
    hidden: document.getElementById("menu-layer")?.hidden ?? null
  }));
  assert(afterMenuOpen.hidden === false, "Menu action did not open menu.", {
    before,
    afterMenuOpen
  });

  await page.keyboard.press("m");
  await page.waitForTimeout(300);
  const afterMenuClose = await page.evaluate(() => ({
    hidden: document.getElementById("menu-layer")?.hidden ?? null
  }));
  assert(afterMenuClose.hidden === true, "Menu shortcut did not close menu after command-panel open.", {
    afterMenuOpen,
    afterMenuClose
  });

  const runBefore = await page.evaluate(() => ({
    status: window.__genericalgoidDebug.getState().statusText
  }));
  await clickAction("run");
  const runAfterPause = await page.evaluate(() => ({
    status: window.__genericalgoidDebug.getState().statusText
  }));
  assert(runAfterPause.status !== runBefore.status, "Run action did not toggle pause state.", {
    runBefore,
    runAfterPause
  });

  await activateActionWithKeyboard("run");
  const runAfterResume = await page.evaluate(() => ({
    status: window.__genericalgoidDebug.getState().statusText
  }));
  assert(runAfterResume.status === runBefore.status, "Run keyboard activation did not toggle back.", {
    runBefore,
    runAfterPause,
    runAfterResume
  });

  const resetBefore = await page.evaluate(() => window.__genericalgoidDebug.getState().resetCount);
  await clickAction("reset");
  const resetAfter = await page.evaluate(() => window.__genericalgoidDebug.getState().resetCount);
  assert(resetAfter === resetBefore + 1, "Reset action did not reseed world.", {
    resetBefore,
    resetAfter
  });

  await clickAction("fullscreen");
  const fullscreenAfter = await page.evaluate(() => Boolean(document.fullscreenElement));
  assert(fullscreenAfter === true, "Fullscreen action did not enter fullscreen.", {
    fullscreenAfter
  });

  await page.evaluate(async () => {
    if (document.fullscreenElement && document.exitFullscreen) {
      await document.exitFullscreen();
    }
  });
  await page.waitForTimeout(500);
  const fullscreenExited = await page.evaluate(() => Boolean(document.fullscreenElement));
  assert(fullscreenExited === false, "Fullscreen did not exit after command-panel fullscreen.", {
    fullscreenExited
  });

  await clickAction("developer");
  await page.waitForURL("**/dev.html", { timeout: 4000 });
  const devAfter = await page.evaluate(() => location.pathname);
  assert(
    devAfter.endsWith("/dev.html") || devAfter === "/dev.html",
    "Developer action did not navigate to dev page.",
    { devAfter }
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        before,
        afterMenuOpen,
        afterMenuClose,
        runBefore,
        runAfterPause,
        runAfterResume,
        resetBefore,
        resetAfter,
        fullscreenAfter,
        fullscreenExited,
        devAfter
      },
      null,
      2
    )
  );
} finally {
  await browser.close();
}
