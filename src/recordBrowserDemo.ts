import path from "node:path";
import type { BrowserRecordingResult, DemoPlan } from "./types.js";
import { ensureDir } from "./fileUtils.js";

function urlForRoute(baseUrl: string, route?: string): string {
  if (!route || route === "/") {
    return baseUrl;
  }
  return new URL(route.replace(/^\//, ""), baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`).toString();
}

async function screenshot(page: import("playwright").Page, screenshotsDir: string, name: string): Promise<string> {
  const safeName = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "scene";
  const screenshotPath = path.join(screenshotsDir, `${safeName}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  return screenshotPath;
}

async function visibleTexts(page: import("playwright").Page): Promise<string[]> {
  return page
    .locator("h1,h2,h3,button,a,label,input,select,textarea,[role='button']")
    .evaluateAll((nodes) =>
      nodes
        .map((node) => {
          const element = node as HTMLElement;
          const label = element.getAttribute("aria-label") || element.getAttribute("placeholder") || element.textContent || "";
          return label.trim();
        })
        .filter(Boolean)
        .slice(0, 30)
    )
    .catch(() => []);
}

async function clickFirstMatching(page: import("playwright").Page, patterns: RegExp[]): Promise<string | undefined> {
  for (const pattern of patterns) {
    const locator = page.getByRole("button", { name: pattern }).or(page.getByRole("link", { name: pattern })).first();
    if (await locator.isVisible().catch(() => false)) {
      const label = await locator.textContent().catch(() => pattern.source);
      await locator.click({ timeout: 5_000 }).catch(() => undefined);
      await page.waitForTimeout(600);
      return `clicked ${label?.trim() || pattern.source}`;
    }
  }
  return undefined;
}

async function fillDemoInputs(page: import("playwright").Page): Promise<string[]> {
  const actions: string[] = [];
  const inputs = page.locator("input:not([type='hidden']):not([type='password']), textarea");
  const count = Math.min(await inputs.count().catch(() => 0), 4);
  const samples = ["15-112", "Demo Course", "3", "Sample item"];

  for (let index = 0; index < count; index += 1) {
    const input = inputs.nth(index);
    if (!(await input.isVisible().catch(() => false))) continue;
    const type = (await input.getAttribute("type").catch(() => "")) ?? "";
    const sample = /number/i.test(type) ? "3" : samples[index] ?? "Demo";
    await input.fill(sample, { timeout: 5_000 }).catch(() => undefined);
    actions.push(`filled input ${index + 1}`);
  }

  const selects = page.locator("select");
  const selectCount = Math.min(await selects.count().catch(() => 0), 3);
  for (let index = 0; index < selectCount; index += 1) {
    const select = selects.nth(index);
    if (!(await select.isVisible().catch(() => false))) continue;
    const values = await select.locator("option").evaluateAll((options) =>
      options.map((option) => (option as HTMLOptionElement).value).filter(Boolean)
    );
    if (values[1] || values[0]) {
      await select.selectOption(values[1] ?? values[0]).catch(() => undefined);
      actions.push(`selected option ${index + 1}`);
    }
  }

  if (actions.length) {
    await page.waitForTimeout(600);
  }
  return actions;
}

async function performHeuristicDemo(page: import("playwright").Page, screenshotsDir: string): Promise<{ artifacts: string[]; observations: string[] }> {
  const artifacts: string[] = [];
  const observations: string[] = [];
  const beforeTexts = await visibleTexts(page);
  observations.push(`visible controls: ${beforeTexts.join(" | ") || "none"}`);
  artifacts.push(await screenshot(page, screenshotsDir, "dom-initial"));

  const filled = await fillDemoInputs(page);
  if (filled.length) {
    observations.push(filled.join("; "));
    artifacts.push(await screenshot(page, screenshotsDir, "dom-filled-inputs"));
  }

  const clickPatterns = [/^add$/i, /calculate/i, /method/i, /resources/i, /settings/i, /new/i, /create/i];
  for (let index = 0; index < 6; index += 1) {
    const action = await clickFirstMatching(page, clickPatterns);
    if (!action) break;
    observations.push(action);
    artifacts.push(await screenshot(page, screenshotsDir, `dom-action-${index + 1}`));
  }

  return { artifacts, observations };
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
  const screenshotsDir = path.join(outputDir, "screenshots");
  await ensureDir(recordingsDir);
  await ensureDir(screenshotsDir);

  const artifacts: string[] = [];
  const observations: string[] = [];
  const browser = await playwright.chromium.launch({ headless: true });
  let canonicalVideo: string | undefined;

  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      recordVideo: { dir: recordingsDir, size: { width: 1440, height: 900 } }
    });
    const page = await context.newPage();
    const video = page.video();

    for (const [index, step] of plan.browserSequence.slice(0, 5).entries()) {
      const targetUrl = urlForRoute(baseUrl, step.route);
      await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 20_000 });
      await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => undefined);

      const title = await page.title().catch(() => "");
      const headings = await page.locator("h1,h2").evaluateAll((nodes) => nodes.map((node) => node.textContent?.trim()).filter(Boolean).slice(0, 6));
      observations.push(`${step.title}: ${title || "untitled page"}${headings.length ? `; headings: ${headings.join(" | ")}` : ""}`);

      artifacts.push(await screenshot(page, screenshotsDir, `scene-${index + 1}-${step.title}`));
    }

    if (!plan.browserSequence.length) {
      await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 20_000 });
      await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => undefined);
    }

    const heuristic = await performHeuristicDemo(page, screenshotsDir);
    artifacts.push(...heuristic.artifacts);
    observations.push(...heuristic.observations);

    await context.close();
    canonicalVideo = await video?.path().catch(() => undefined);
    if (canonicalVideo) {
      artifacts.push(canonicalVideo);
    }
    return {
      attempted: true,
      success: true,
      artifacts,
      canonicalVideo,
      observations,
      warnings: []
    };
  } catch (error) {
    return {
      attempted: true,
      success: false,
      artifacts,
      canonicalVideo,
      observations,
      warnings: [`Browser recording failed: ${error instanceof Error ? error.message : String(error)}`]
    };
  } finally {
    await browser.close();
  }
}
