import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const IGNORED_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  ".svelte-kit",
  ".turbo",
  "output",
  "playwright-report",
  "test-results"
]);

function isIgnoredDir(name: string): boolean {
  return IGNORED_DIRS.has(name) || /^demoOutput-\d{4}-\d{2}-\d{2}-\d{6}(?:-\d+)?$/.test(name);
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatLocalTimestamp(date = new Date()): string {
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hour = pad(date.getHours());
  const minute = pad(date.getMinutes());
  const second = pad(date.getSeconds());
  return `${year}-${month}-${day}-${hour}${minute}${second}`;
}

export async function createTimestampedOutputDir(repoPath: string, date = new Date()): Promise<string> {
  const baseName = `demoOutput-${formatLocalTimestamp(date)}`;

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const suffix = attempt === 0 ? "" : `-${pad(attempt)}`;
    const candidate = path.join(repoPath, `${baseName}${suffix}`);
    try {
      await mkdir(candidate, { recursive: false });
      return candidate;
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
      if (code !== "EEXIST") {
        throw error;
      }
    }
  }

  throw new Error(`Could not create a unique output directory for ${baseName}`);
}

export async function pathExists(target: string): Promise<boolean> {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

export async function readTextIfExists(target: string): Promise<string | undefined> {
  if (!(await pathExists(target))) {
    return undefined;
  }
  return readFile(target, "utf8");
}

export async function ensureDir(target: string): Promise<void> {
  await mkdir(target, { recursive: true });
}

export async function writeText(target: string, content: string): Promise<void> {
  await ensureDir(path.dirname(target));
  await writeFile(target, content, "utf8");
}

export async function writeJson(target: string, value: unknown): Promise<void> {
  await writeText(target, `${JSON.stringify(value, null, 2)}\n`);
}

export async function listFiles(root: string, maxFiles = 600): Promise<string[]> {
  const results: string[] = [];

  async function walk(current: string): Promise<void> {
    if (results.length >= maxFiles) {
      return;
    }

    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (results.length >= maxFiles) {
        break;
      }

      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!isIgnoredDir(entry.name)) {
          await walk(absolute);
        }
      } else if (entry.isFile()) {
        results.push(absolute);
      }
    }
  }

  await walk(root);
  return results;
}

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function titleFromSlug(value: string): string {
  return normalizeWhitespace(
    value
      .replace(/\.[^.]+$/, "")
      .replace(/[-_]+/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
  ).replace(/\b\w/g, (char) => char.toUpperCase());
}

export function confidenceRank(value: "high" | "medium" | "low"): number {
  return value === "high" ? 3 : value === "medium" ? 2 : 1;
}

export function combineConfidence(values: Array<"high" | "medium" | "low">): "high" | "medium" | "low" {
  if (values.includes("low")) {
    return "low";
  }
  if (values.includes("medium")) {
    return "medium";
  }
  return "high";
}

export function uniqueBy<T>(items: T[], getKey: (item: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const key = getKey(item).toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }
  return result;
}

export function extractUrls(text: string): string[] {
  const urls = text.match(/https?:\/\/[^\s)>"']+/g) ?? [];
  return uniqueBy(urls.map((url) => url.replace(/[.,;]+$/, "")), (url) => url);
}

export function maskSecrets(text: string): string {
  return text
    .replace(/((?:password|passcode|token|secret|api[_ -]?key)\s*[:=]\s*)([^\s]+)/gi, "$1[redacted]")
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, "$1[redacted]");
}

export function toPosixPath(value: string): string {
  return value.split(path.sep).join("/");
}

export function isProbablyGitHubUrl(value: string): boolean {
  return /^https?:\/\/github\.com\/[^/\s]+\/[^/\s]+\/?$/.test(value);
}
