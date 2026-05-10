import path from "node:path";
import type { BrowserRecordingResult, DemoPlan } from "./types.js";
import { ensureDir } from "./fileUtils.js";

function urlForRoute(baseUrl: string, route?: string): string {
  if (!route || route === "/") {
    return baseUrl;
  }
  return new URL(route.replace(/^\//, ""), baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`).toString();
}

export async function recordBrowserDemo(baseUrl: string | undefined, plan: DemoPlan, outputDir: string): Promise<BrowserRecordingResult> {
  if (!baseUrl) {
    return {
      attempted: false,
      success: false,
      artifacts: [],
      observations: [],
      warnings: ["No deployed or local URL was available for browser recording."]
    };
  }

  let playwright: typeof import("playwright");
  try {
    playwright = await import("playwright");
  } catch {
    return {
      attempted: true,
      success: false,
      artifacts: [],
      observations: [],
      warnings: ["Playwright is not installed. Run npm install to enable browser recording."]
    };
  }

  const recordingsDir = path.join(outputDir, "recordings");
  await ensureDir(recordingsDir);

  const artifacts: string[] = [];
  const observations: string[] = [];
  const browser = await playwright.chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      recordVideo: { dir: recordingsDir, size: { width: 1440, height: 900 } }
    });
    const page = await context.newPage();

    for (const [index, step] of plan.browserSequence.slice(0, 5).entries()) {
      const targetUrl = urlForRoute(baseUrl, step.route);
      await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 20_000 });
      await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => undefined);

      const title = await page.title().catch(() => "");
      const headings = await page.locator("h1,h2").evaluateAll((nodes) => nodes.map((node) => node.textContent?.trim()).filter(Boolean).slice(0, 6));
      observations.push(`${step.title}: ${title || "untitled page"}${headings.length ? `; headings: ${headings.join(" | ")}` : ""}`);

      const screenshotPath = path.join(recordingsDir, `scene-${index + 1}-${step.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      artifacts.push(screenshotPath);
    }

    await context.close();
    return {
      attempted: true,
      success: true,
      artifacts,
      observations,
      warnings: []
    };
  } catch (error) {
    return {
      attempted: true,
      success: false,
      artifacts,
      observations,
      warnings: [`Browser recording failed: ${error instanceof Error ? error.message : String(error)}`]
    };
  } finally {
    await browser.close();
  }
}
