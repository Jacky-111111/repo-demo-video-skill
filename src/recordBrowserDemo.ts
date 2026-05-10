import path from "node:path";
import type { BrowserRecordingResult, DemoPlan } from "./types.js";
import { ensureDir } from "./fileUtils.js";

function urlForRoute(baseUrl: string, route?: string): string {
  if (!route || route === "/") {
    return baseUrl;
  }
  return new URL(route.replace(/^\//, ""), baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`).toString();
}

const SCENE_HOLD_MS = 8_000;
const ACTION_HOLD_MS = 2_500;

async function setDemoCallout(page: import("playwright").Page, message: string): Promise<void> {
  await page.evaluate((text) => {
    let el = document.getElementById("codex-demo-callout");
    if (!el) {
      el = document.createElement("div");
      el.id = "codex-demo-callout";
      document.body.appendChild(el);
    }

    el.textContent = text;
    el.setAttribute(
      "style",
      [
        "position: fixed",
        "left: 24px",
        "right: 24px",
        "bottom: 24px",
        "z-index: 999999",
        "padding: 14px 18px",
        "border-radius: 8px",
        "background: rgba(17, 24, 39, 0.88)",
        "color: white",
        "font: 600 18px/1.35 system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        "letter-spacing: 0",
        "box-shadow: 0 12px 32px rgba(0, 0, 0, 0.22)",
        "pointer-events: none"
      ].join(";")
    );
  }, message.slice(0, 180));
}

async function clearDemoRing(page: import("playwright").Page): Promise<void> {
  await page.evaluate(() => {
    const ring = document.getElementById("codex-demo-ring");
    if (ring) {
      ring.style.display = "none";
    }
  });
}

async function highlightLocator(locator: import("playwright").Locator, message: string): Promise<void> {
  await locator.evaluate((target, text) => {
    let callout = document.getElementById("codex-demo-callout");
    if (!callout) {
      callout = document.createElement("div");
      callout.id = "codex-demo-callout";
      document.body.appendChild(callout);
    }
    callout.textContent = text;
    callout.setAttribute(
      "style",
      [
        "position: fixed",
        "left: 24px",
        "right: 24px",
        "bottom: 24px",
        "z-index: 999999",
        "padding: 14px 18px",
        "border-radius: 8px",
        "background: rgba(17, 24, 39, 0.88)",
        "color: white",
        "font: 600 18px/1.35 system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        "letter-spacing: 0",
        "box-shadow: 0 12px 32px rgba(0, 0, 0, 0.22)",
        "pointer-events: none"
      ].join(";")
    );

    let ring = document.getElementById("codex-demo-ring");
    if (!ring) {
      ring = document.createElement("div");
      ring.id = "codex-demo-ring";
      document.body.appendChild(ring);
    }

    const rect = (target as HTMLElement).getBoundingClientRect();
    ring.setAttribute(
      "style",
      [
        "position: fixed",
        `left: ${Math.max(rect.left - 8, 8)}px`,
        `top: ${Math.max(rect.top - 8, 8)}px`,
        `width: ${Math.max(rect.width + 16, 24)}px`,
        `height: ${Math.max(rect.height + 16, 24)}px`,
        "border: 3px solid #f5c542",
        "border-radius: 8px",
        "z-index: 999998",
        "box-shadow: 0 0 0 4px rgba(245, 197, 66, 0.22)",
        "pointer-events: none",
        "display: block"
      ].join(";")
    );
  }, message.slice(0, 180));
}

async function highlightSelector(page: import("playwright").Page, selector: string, message: string): Promise<void> {
  const locator = page.locator(selector).first();
  if (await locator.isVisible().catch(() => false)) {
    await highlightLocator(locator, message);
  } else {
    await setDemoCallout(page, message);
    await clearDemoRing(page);
  }
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
      await highlightLocator(locator, `Show ${label?.trim() || "this control"}.`);
      await locator.click({ timeout: 5_000 }).catch(() => undefined);
      await page.waitForTimeout(ACTION_HOLD_MS);
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
    await highlightLocator(input, "Fill in safe sample data for the demo.");
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
      await highlightLocator(select, "Choose a visible demo option.");
      await select.selectOption(values[1] ?? values[0]).catch(() => undefined);
      actions.push(`selected option ${index + 1}`);
    }
  }

  if (actions.length) {
    await page.waitForTimeout(ACTION_HOLD_MS);
  }
  return actions;
}

async function performHeuristicDemo(page: import("playwright").Page, screenshotsDir: string): Promise<{ artifacts: string[]; observations: string[] }> {
  const artifacts: string[] = [];
  const observations: string[] = [];
  const beforeTexts = await visibleTexts(page);
  await setDemoCallout(page, "Explore the live UI and highlight meaningful product states.");
  await clearDemoRing(page);
  observations.push(`visible controls: ${beforeTexts.join(" | ") || "none"}`);
  await page.waitForTimeout(ACTION_HOLD_MS);
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
      const actionSelector = step.actions.find((action) => action.selector)?.selector;
      if (actionSelector) {
        await highlightSelector(page, actionSelector, step.narrationGoal);
      } else {
        await setDemoCallout(page, step.narrationGoal);
        await clearDemoRing(page);
      }

      await page.waitForTimeout(SCENE_HOLD_MS);
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
