import { chromium } from "playwright-core";

const GUIDE_URLS = [
  process.env.GUIDE_URL,
  "http://127.0.0.1:4173/guide.html",
  "http://127.0.0.1:4174/guide.html"
].filter(Boolean);
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
  const page = await browser.newPage({ viewport: { width: 2400, height: 1400 } });
  let activeUrl = null;
  let lastError = null;

  for (const candidate of GUIDE_URLS) {
    try {
      await page.goto(candidate, { waitUntil: "networkidle" });
      activeUrl = candidate;
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!activeUrl) {
    throw lastError ?? new Error("Could not reach guide page.");
  }

  await page.waitForSelector("#guide-overview");
  await page.waitForTimeout(300);

  const metrics = await page.evaluate(() => {
    const sectionSelectors = [
      "#guide-overview",
      "#guide-gadgets-panel",
      "#guide-genetics-panel",
      "#guide-tags-panel",
      "#guide-rules-panel",
      "#guide-behavior-panel",
      "#guide-read-panel",
      "#guide-experiments-panel"
    ];

    const sections = sectionSelectors.map((selector) => {
      const node = document.querySelector(selector);
      if (!node) {
        return { selector, missing: true };
      }
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      const paddingTop = Number.parseFloat(style.paddingTop || "0") || 0;
      const paddingBottom = Number.parseFloat(style.paddingBottom || "0") || 0;
      const children = [...node.children].filter(
        (child) => getComputedStyle(child).display !== "none" && child.getBoundingClientRect().height > 0
      );
      const firstChildRect = children[0]?.getBoundingClientRect() ?? rect;
      const lastChildRect = children.at(-1)?.getBoundingClientRect() ?? rect;
      const figureCount = node.querySelectorAll(".guide-figure-svg").length;
      const chipCount = node.querySelectorAll(".guide-lineage-tag, .guide-gene-chip").length;
      const textLength = (node.textContent || "").replace(/\s+/g, " ").trim().length;
      const topGap = Math.round(firstChildRect.top - rect.top - paddingTop);
      const bottomGap = Math.round(rect.bottom - lastChildRect.bottom - paddingBottom);
      const fillRatio =
        rect.height > paddingTop + paddingBottom
          ? Number(
              (
                (lastChildRect.bottom - firstChildRect.top) /
                Math.max(1, rect.height - paddingTop - paddingBottom)
              ).toFixed(3)
            )
          : 1;

      return {
        selector,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        textLength,
        figureCount,
        chipCount,
        topGap,
        bottomGap,
        fillRatio
      };
    });

    const sectionsRoot = document.querySelector("#guide-sections");
    const sectionRootRect = sectionsRoot?.getBoundingClientRect();
    const masonryColumns = [...document.querySelectorAll("#guide-sections > .guide-sections-column")].map((node) => {
      const rect = node.getBoundingClientRect();
      return {
        top: Math.round(rect.top),
        left: Math.round(rect.left),
        width: Math.round(rect.width),
        height: Math.round(rect.height)
      };
    });

    const layoutRect = document.querySelector(".dev-layout")?.getBoundingClientRect();

    return {
      title: document.title,
      figureCount: document.querySelectorAll(".guide-figure-svg").length,
      shareDonutCount: document.querySelectorAll(".guide-share-donut").length,
      notePanels: document.querySelectorAll("#guide-notes, .guide-notes-panel").length,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      sectionsRoot: sectionRootRect
        ? {
            width: Math.round(sectionRootRect.width),
            height: Math.round(sectionRootRect.height)
          }
        : null,
      layoutRect: layoutRect
        ? {
            width: Math.round(layoutRect.width),
            rightGap: Math.round(window.innerWidth - layoutRect.right)
          }
        : null,
      masonryColumns,
      sections
    };
  });

  await page.screenshot({ path: "/tmp/genericalgoid-guide-full.png", fullPage: true });
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.screenshot({ path: "/tmp/genericalgoid-guide-top.png", fullPage: false });
  await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }));
  await page.waitForTimeout(200);
  await page.screenshot({ path: "/tmp/genericalgoid-guide-bottom.png", fullPage: false });

  const missing = metrics.sections.filter((section) => section.missing);
  const emptyish = metrics.sections.filter(
    (section) => !section.missing && section.textLength < 90 && section.figureCount === 0
  );
  const bottomGapWarnings = metrics.sections.filter(
    (section) => !section.missing && section.bottomGap > 40
  );
  const fillWarnings = metrics.sections.filter(
    (section) => !section.missing && section.fillRatio < 0.72
  );
  const masonryHeights = metrics.masonryColumns.map((column) => column.height);
  const masonrySpread =
    masonryHeights.length > 1 ? Math.max(...masonryHeights) - Math.min(...masonryHeights) : 0;

  assert(missing.length === 0, "Guide is missing expected panels.", { missing, metrics });
  assert(emptyish.length === 0, "Guide has near-empty panels.", { emptyish, metrics });
  assert(metrics.figureCount >= 12, "Guide does not contain enough visuals.", { metrics });
  assert(metrics.shareDonutCount >= 2, "Guide is missing lineage share visuals.", { metrics });
  assert(metrics.notePanels === 0, "Obsolete empty notes panel still exists.", { metrics });
  assert(bottomGapWarnings.length === 0, "Guide has large bottom dead-space in panels.", {
    bottomGapWarnings,
    metrics
  });
  assert(fillWarnings.length === 0, "Guide panels are not filled densely enough.", {
    fillWarnings,
    metrics
  });
  assert(metrics.layoutRect && metrics.layoutRect.rightGap <= 24, "Guide layout leaves excessive right-side dead space.", {
    metrics
  });
  assert(metrics.masonryColumns.length === 2, "Wide guide layout did not settle into the expected two-column packing.", {
    metrics
  });
  assert(masonrySpread <= 520, "Guide masonry columns are imbalanced enough to leave visible dead space.", {
    masonrySpread,
    metrics
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        url: activeUrl,
        masonrySpread,
        metrics,
        screenshots: [
          "/tmp/genericalgoid-guide-full.png",
          "/tmp/genericalgoid-guide-top.png",
          "/tmp/genericalgoid-guide-bottom.png"
        ]
      },
      null,
      2
    )
  );
} finally {
  await browser.close();
}
