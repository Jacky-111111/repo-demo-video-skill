import type { ReadmeAnalysis, ReadmeFeature } from "./types.js";
import { extractUrls, maskSecrets, normalizeWhitespace } from "./fileUtils.js";

const SUMMARY_HEADINGS = new Set(["about", "overview", "description", "what it does", "introduction"]);
const FEATURE_HEADINGS = ["feature", "capabilit", "what it does", "highlights"];
const USAGE_HEADINGS = ["usage", "how to use", "workflow", "demo", "quick start", "getting started"];
const BADGE_WORDS = /\b(?:badge|shield|license|version|coverage|build|npm|ci|status|stars?|forks?)\b/i;

function normalizeHeading(value: string): string {
  return value
    .toLowerCase()
    .replace(/<[^>]+>/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function stripMarkdown(value: string): string {
  return normalizeWhitespace(
    value
      .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
      .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
      .replace(/<img\b[^>]*>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/[`*_~>#|]/g, " ")
  );
}

function isBadgeOrDecorativeLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (/!\[[^\]]*]\([^)]*(?:shields\.io|badge|license|npm|coverage|build)[^)]*\)/i.test(trimmed)) return true;
  if (/<img\b[^>]*(?:shields\.io|badge|license|npm|coverage|build)[^>]*>/i.test(trimmed)) return true;
  if (/^\|?\s*(?:!\[[^\]]*]\([^)]*\)\s*\|?\s*)+$/.test(trimmed)) return true;
  if (/^https?:\/\/\S+$/.test(trimmed)) return true;
  return false;
}

function cleanReadme(raw: string): string {
  return maskSecrets(raw)
    .split(/\r?\n/)
    .filter((line) => !isBadgeOrDecorativeLine(line))
    .join("\n");
}

function parseSections(markdown: string): Record<string, string> {
  const sections: Record<string, string> = {};
  let currentHeading: string | undefined;
  let currentLines: string[] = [];

  function flush(): void {
    if (currentHeading) {
      const body = currentLines.join("\n").trim();
      if (body) sections[currentHeading] = body;
    }
    currentLines = [];
  }

  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^#{2,6}\s+(.+?)\s*$/);
    if (heading) {
      flush();
      currentHeading = normalizeHeading(heading[1] ?? "");
    } else if (currentHeading) {
      currentLines.push(line);
    }
  }

  flush();
  return sections;
}

function findTitle(markdown: string): string | undefined {
  const title = markdown.match(/^#\s+(.+?)\s*$/m)?.[1];
  return title ? stripMarkdown(title) : undefined;
}

function findBlockquoteSummary(markdown: string): string | undefined {
  const quote = markdown
    .split(/\r?\n/)
    .filter((line) => /^>\s+/.test(line))
    .map((line) => line.replace(/^>\s+/, ""))
    .join(" ");
  const cleaned = stripMarkdown(quote);
  return isGoodSummary(cleaned) ? cleaned : undefined;
}

function isGoodSummary(value: string | undefined): value is string {
  if (!value) return false;
  if (value.length < 30 || value.length > 600) return false;
  if (/!\[|shields\.io|https?:\/\//i.test(value)) return false;
  if (BADGE_WORDS.test(value) && value.length < 140) return false;
  const symbolRatio = value.replace(/[A-Za-z0-9\s.,;:'"()/-]/g, "").length / Math.max(value.length, 1);
  return symbolRatio < 0.18;
}

function findSummary(markdown: string, sections: Record<string, string>): string | undefined {
  for (const [heading, body] of Object.entries(sections)) {
    if (SUMMARY_HEADINGS.has(heading)) {
      const paragraph = body.split(/\n\s*\n/).map(stripMarkdown).find(isGoodSummary);
      if (paragraph) return paragraph;
    }
  }

  const withoutTitle = markdown.replace(/^#\s+.+?\s*$/m, "");
  return withoutTitle
    .split(/\n\s*\n/)
    .map(stripMarkdown)
    .find(isGoodSummary);
}

function parseFeatureLine(line: string, sourceHeading: string): ReadmeFeature | undefined {
  const stripped = stripMarkdown(line.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, ""));
  if (!stripped || stripped.length < 3 || stripped.length > 240) return undefined;
  if (/^(npm|pnpm|yarn|bun)\s+/i.test(stripped)) return undefined;

  const parts = stripped.split(/\s*(?::| - |\u2013|\u2014)\s*/);
  const name = normalizeWhitespace(parts[0] ?? stripped).slice(0, 80);
  const description = normalizeWhitespace(parts.length > 1 ? stripped : `${name} feature`);
  if (!name) return undefined;
  return { name, description, sourceHeading };
}

function extractListItems(section: string): string[] {
  return section
    .split(/\r?\n/)
    .filter((line) => /^\s*(?:[-*+]|\d+[.)])\s+/.test(line))
    .map((line) => line.trim());
}

function extractFeatures(sections: Record<string, string>): ReadmeFeature[] {
  const features: ReadmeFeature[] = [];
  for (const [heading, body] of Object.entries(sections)) {
    if (!FEATURE_HEADINGS.some((candidate) => heading.includes(candidate))) {
      continue;
    }
    for (const line of extractListItems(body)) {
      const feature = parseFeatureLine(line, heading);
      if (feature) features.push(feature);
    }
  }
  return features.slice(0, 12);
}

function extractUsageSteps(sections: Record<string, string>): string[] {
  for (const [heading, body] of Object.entries(sections)) {
    if (USAGE_HEADINGS.some((candidate) => heading.includes(candidate))) {
      const steps = extractListItems(body).map((line) => stripMarkdown(line.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, "")));
      if (steps.length) return steps.slice(0, 10);
    }
  }
  return [];
}

export function parseReadme(raw: string | undefined, readmePath?: string): ReadmeAnalysis {
  if (!raw) {
    return {
      path: readmePath,
      sections: {},
      features: [],
      usageSteps: [],
      urls: [],
      warnings: ["README.md was not found."]
    };
  }

  const cleaned = cleanReadme(raw);
  const sections = parseSections(cleaned);
  const blockquoteSummary = findBlockquoteSummary(cleaned);
  const summary = blockquoteSummary ?? findSummary(cleaned, sections);
  const warnings: string[] = [];

  if (!summary) {
    warnings.push("No clean README summary could be extracted after removing badges and decorative lines.");
  }

  return {
    path: readmePath,
    title: findTitle(cleaned),
    summary,
    blockquoteSummary,
    sections,
    features: extractFeatures(sections),
    usageSteps: extractUsageSteps(sections),
    urls: extractUrls(cleaned),
    warnings
  };
}
