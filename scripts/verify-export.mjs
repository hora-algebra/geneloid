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
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1600, height: 1000 }
  });
  const page = await context.newPage();

  await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => typeof window.__genericalgoidDebug?.getState === "function");
  await page.waitForTimeout(500);

  await page.click("#toggle-menu");
  await page.waitForFunction(() => {
    const layer = document.getElementById("menu-layer");
    return Boolean(layer) && layer.hidden === false;
  });

  const snapshotPromise = page.waitForEvent("download");
  await page.click("#export-snapshot");
  const snapshotDownload = await snapshotPromise;
  const snapshotName = snapshotDownload.suggestedFilename();
  assert(/\.png$/i.test(snapshotName), "Snapshot export did not produce a PNG download.", {
    snapshotName
  });

  const statusAfterSnapshot = await page.locator("#status-pill").textContent();
  assert(statusAfterSnapshot && /png|saved|書き出し|保存/i.test(statusAfterSnapshot), "Snapshot export did not report success.", {
    statusAfterSnapshot
  });

  const videoPromise = page.waitForEvent("download", { timeout: 15000 });
  await page.click("#export-video");
  const statusDuringVideo = await page.locator("#status-pill").textContent();
  assert(statusDuringVideo && /video|record|録画/i.test(statusDuringVideo), "Video export did not report start.", {
    statusDuringVideo
  });
  const videoDownload = await videoPromise;
  const videoName = videoDownload.suggestedFilename();
  assert(/\.webm$/i.test(videoName), "Video export did not produce a WebM download.", {
    videoName
  });

  const statusAfterVideo = await page.locator("#status-pill").textContent();
  assert(statusAfterVideo && /webm|video|saved|書き出し|保存/i.test(statusAfterVideo), "Video export did not report success.", {
    statusAfterVideo
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        snapshotName,
        videoName,
        statusAfterSnapshot,
        statusDuringVideo,
        statusAfterVideo
      },
      null,
      2
    )
  );
} finally {
  await browser.close();
}
