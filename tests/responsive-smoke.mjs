import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const widths = [375, 768, 1280];
const surfaces = [
  ["AI Assistant", "Your security sidekick."],
  ["MCP Connect", "Connect an agent, keep it read-only."],
  ["Lifeline Rewards", "Resilience, made visible."],
  ["Activity", "Activity"],
];

async function openNavigation(page, width, label) {
  if (width <= 760) await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("button", { name: label, exact: true }).click();
}

const browser = await chromium.launch({ headless: true });
await mkdir("tests/screenshots", { recursive: true });
try {
  for (const width of widths) {
    const page = await browser.newPage({
      viewport: { width, height: 960 },
      reducedMotion: "reduce",
    });
    const pageErrors = [];
    const failedRequests = [];
    page.on("pageerror", error => pageErrors.push(error.message));
    page.on("requestfailed", request => failedRequests.push(`${request.url()} (${request.failure()?.errorText ?? "failed"})`));
    await page.route(/fonts\.(googleapis|gstatic)\.com/, route => route.abort());
    const response = await page.goto("http://127.0.0.1:5173", { waitUntil: "commit", timeout: 30_000 });
    assert.ok(response, `Vite did not return a document at ${width}px.`);
    try {
      await page.waitForLoadState("domcontentloaded", { timeout: 10_000 });
    } catch {
      const currentDocument = await page.evaluate(() => ({ state: document.readyState, title: document.title }));
      console.log(`NOTE width=${width}px DOMContentLoaded timed out: ${JSON.stringify(currentDocument)}; failed=${failedRequests.length}`);
    }
    try {
      await page.waitForLoadState("networkidle", { timeout: 8_000 });
    } catch {
      console.log(`NOTE width=${width}px networkidle timed out; requests=${failedRequests.length} failed`);
    }
    await page.getByRole("heading", { name: "A recovery plan for your wallet." }).waitFor();
    await page.locator(".api-offline-banner").getByText("The ReKey API is offline").waitFor();

    const logoIsLoaded = await page.locator('img[src="/rekey-logo.jpg"]').first().evaluate(
      image => image.complete && image.naturalWidth === 1280,
    );
    assert.ok(logoIsLoaded, `The supplied logo failed to load at ${width}px.`);
    let dimensions;
    for (const [label, heading] of surfaces) {
      await openNavigation(page, width, label);
      await page.getByRole("heading", { name: heading, exact: true }).waitFor();
      dimensions = await page.evaluate(() => ({
        viewport: window.innerWidth,
        document: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
      }));
      assert.ok(dimensions.document <= width, `Document overflows at ${width}px on ${label}: ${JSON.stringify(dimensions)}`);
      assert.ok(dimensions.body <= width, `Body overflows at ${width}px on ${label}: ${JSON.stringify(dimensions)}`);
    }

    await openNavigation(page, width, "Recovery");
    await page.getByRole("heading", { name: "Guardian-flow simulation" }).waitFor();
    assert.ok(await page.getByText("SIMULATED · NO CHAIN CHANGES").count() > 0);
    await page.getByRole("button", { name: "Start demo recovery" }).click();
    await page.getByRole("button", { name: "Guardian Alpha" }).click();
    await page.getByRole("button", { name: "Guardian Beta" }).click();
    await page.locator(".success-message").waitFor();
    assert.equal(await page.getByRole("button", { name: "Sign & verify · no submit" }).count(), 0);
    assert.deepEqual(pageErrors, [], `Browser runtime errors at ${width}px: ${pageErrors.join("; ")}`);
    await page.screenshot({ path: `tests/screenshots/rekey-${width}.png`, fullPage: true });

    console.log(`PASS width=${width}px document=${dimensions.document}px body=${dimensions.body}px logo=1280x1280 demo=simulated runtime_errors=0 failed_requests=${failedRequests.length} screenshot=tests/screenshots/rekey-${width}.png`);
    await page.close();
  }
} finally {
  await browser.close();
}