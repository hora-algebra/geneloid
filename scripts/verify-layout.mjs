import { chromium } from "playwright-core";

const URL = process.env.VERIFY_URL ?? "http://127.0.0.1:4173/";
const CHROME_PATH =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

function roundRect(rect) {
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    right: Math.round(rect.right),
    bottom: Math.round(rect.bottom)
  };
}

async function waitForSimulation(page) {
  await page.waitForLoadState("networkidle");
  await page.waitForSelector("#sim-canvas");
  await page.waitForFunction(() => {
    const canvas = document.getElementById("sim-canvas");
    return Boolean(canvas && canvas.clientWidth > 0 && canvas.clientHeight > 0);
  });
  await page.waitForTimeout(300);
}

async function collectMetrics(page, label) {
  const metrics = await page.evaluate((scenarioLabel) => {
    const stagePanel = document.querySelector(".stage-panel");
    const stageShell = document.querySelector(".stage-shell");
    const stageToolbar = document.querySelector(".stage-toolbar");
    const canvasFrame = document.querySelector(".canvas-frame");
    const stats = document.querySelector(".stage-stats-strip");
    const sidebar = document.querySelector(".lineage-sidebar");
    const lineageCard = document.querySelector(".lineage-card");
    const commandsButton = document.getElementById("commands-peek-button");
    const statsButton = document.getElementById("stats-peek-button");
    const canvas = document.getElementById("sim-canvas");
    if (
      !stagePanel ||
      !stageShell ||
      !stageToolbar ||
      !canvasFrame ||
      !stats ||
      !sidebar ||
      !lineageCard ||
      !commandsButton ||
      !statsButton ||
      !canvas
    ) {
      return { label: scenarioLabel, missing: true };
    }

    const stageRect = stagePanel.getBoundingClientRect();
    const shellRect = stageShell.getBoundingClientRect();
    const toolbarRect = stageToolbar.getBoundingClientRect();
    const canvasRect = canvasFrame.getBoundingClientRect();
    const statsRect = stats.getBoundingClientRect();
    const sidebarRect = sidebar.getBoundingClientRect();
    const lineageCardRect = lineageCard.getBoundingClientRect();
    const commandsRect = commandsButton.getBoundingClientRect();
    const statsButtonRect = statsButton.getBoundingClientRect();
    const panelStyles = window.getComputedStyle(stagePanel);
    const sidebarStyles = window.getComputedStyle(sidebar);
    const paddingRight = Number.parseFloat(panelStyles.paddingRight || "0") || 0;
    const paddingBottom = Number.parseFloat(panelStyles.paddingBottom || "0") || 0;
    const contentRight = stageRect.right - paddingRight;
    const contentBottom = stageRect.bottom - paddingBottom;
    const sidebarPaddingRight = Number.parseFloat(sidebarStyles.paddingRight || "0") || 0;
    const sidebarPaddingBottom = Number.parseFloat(sidebarStyles.paddingBottom || "0") || 0;
    const sidebarContentRight = sidebarRect.right - sidebarPaddingRight;
    const sidebarContentBottom = sidebarRect.bottom - sidebarPaddingBottom;
    const sidebarOccupiedRight = Math.max(lineageCardRect.right, statsRect.right);
    const sidebarOccupiedBottom = Math.max(lineageCardRect.bottom, statsRect.bottom);

    return {
      label: scenarioLabel,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      fullscreen: Boolean(document.fullscreenElement),
      stagePanel: {
        x: stageRect.x,
        y: stageRect.y,
        width: stageRect.width,
        height: stageRect.height,
        right: stageRect.right,
        bottom: stageRect.bottom
      },
      stageShell: {
        x: shellRect.x,
        y: shellRect.y,
        width: shellRect.width,
        height: shellRect.height
      },
      canvasFrame: {
        x: canvasRect.x,
        y: canvasRect.y,
        width: canvasRect.width,
        height: canvasRect.height,
        right: canvasRect.right,
        bottom: canvasRect.bottom
      },
      statsStrip: {
        x: statsRect.x,
        y: statsRect.y,
        width: statsRect.width,
        height: statsRect.height,
        right: statsRect.right,
        bottom: statsRect.bottom
      },
      sidebar: {
        x: sidebarRect.x,
        y: sidebarRect.y,
        width: sidebarRect.width,
        height: sidebarRect.height,
        right: sidebarRect.right,
        bottom: sidebarRect.bottom
      },
      commandsButton: {
        x: commandsRect.x,
        y: commandsRect.y,
        width: commandsRect.width,
        height: commandsRect.height
      },
      statsButton: {
        x: statsButtonRect.x,
        y: statsButtonRect.y,
        width: statsButtonRect.width,
        height: statsButtonRect.height
      },
      worldWithinViewport:
        canvasRect.left >= 0 &&
        canvasRect.top >= 0 &&
        canvasRect.right <= window.innerWidth &&
        canvasRect.bottom <= window.innerHeight,
      worldSizeNonZero: canvas.clientWidth > 0 && canvas.clientHeight > 0,
      stageCanvasRightGap: Math.round(contentRight - canvasRect.right),
      stageCanvasBottomGap: Math.round(contentBottom - canvasRect.bottom),
      stageCanvasOverflowRight: Math.round(canvasRect.right - contentRight),
      stageCanvasOverflowBottom: Math.round(canvasRect.bottom - contentBottom),
      sidebarUnusedRight: Math.round(sidebarContentRight - sidebarOccupiedRight),
      sidebarUnusedBottom: Math.round(sidebarContentBottom - sidebarOccupiedBottom),
      sidebarOverflowRight: Math.round(sidebarOccupiedRight - sidebarContentRight),
      sidebarOverflowBottom: Math.round(sidebarOccupiedBottom - sidebarContentBottom),
      noDeadSpace:
        Math.round(contentRight - canvasRect.right) <= 4 &&
        Math.round(contentBottom - canvasRect.bottom) <= 4 &&
        Math.round(sidebarContentRight - sidebarOccupiedRight) <= 4 &&
        Math.round(sidebarContentBottom - sidebarOccupiedBottom) <= 4
    };
  }, label);

  return {
    ...metrics,
    stagePanel: metrics.stagePanel ? roundRect(metrics.stagePanel) : null,
    stageShell: metrics.stageShell ? roundRect(metrics.stageShell) : null,
    canvasFrame: metrics.canvasFrame ? roundRect(metrics.canvasFrame) : null,
    statsStrip: metrics.statsStrip ? roundRect(metrics.statsStrip) : null,
    sidebar: metrics.sidebar ? roundRect(metrics.sidebar) : null,
    commandsButton: metrics.commandsButton ? roundRect(metrics.commandsButton) : null,
    statsButton: metrics.statsButton ? roundRect(metrics.statsButton) : null
  };
}

async function verifyScenario(browser, { label, viewport, fullscreen = false, screenshot }) {
  const page = await browser.newPage({ viewport });
  await page.goto(URL);
  await waitForSimulation(page);
  if (fullscreen) {
    await page.keyboard.press("f");
    await page.waitForTimeout(450);
  }
  const metrics = await collectMetrics(page, label);
  await page.screenshot({ path: screenshot, fullPage: false });
  await page.close();
  return metrics;
}

const browser = await chromium.launch({
  headless: true,
  executablePath: CHROME_PATH
});

try {
  const normal = await verifyScenario(browser, {
    label: "normal",
    viewport: { width: 1600, height: 1000 },
    screenshot: "/tmp/genericalgoid-normal-layout.png"
  });

  const fullscreen = await verifyScenario(browser, {
    label: "fullscreen",
    viewport: { width: 3440, height: 1440 },
    fullscreen: true,
    screenshot: "/tmp/genericalgoid-fullscreen-layout.png"
  });

  console.log(
    JSON.stringify(
      {
        url: URL,
        normal,
        fullscreen
      },
      null,
      2
    )
  );
} finally {
  await browser.close();
}
