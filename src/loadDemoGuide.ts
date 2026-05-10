import path from "node:path";
import type { DemoGuide } from "./types.js";
import { maskSecrets, normalizeWhitespace, readTextIfExists } from "./fileUtils.js";

function normalizeHeading(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function parseSections(markdown: string): Record<string, string> {
  const sections: Record<string, string> = {};
  let currentHeading: string | undefined;
  let currentLines: string[] = [];

  function flush(): void {
    if (currentHeading) {
      const body = currentLines.join("\n").trim();
      if (body) {
        sections[currentHeading] = body;
      }
    }
    currentLines = [];
  }

  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
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

function listFromSection(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*]|\d+[.)])\s+/, "").trim())
    .filter(Boolean);
}

export async function loadDemoGuide(repoPath: string): Promise<DemoGuide> {
  const guidePath = path.join(repoPath, "DEMO_GUIDE.md");
  const raw = await readTextIfExists(guidePath);

  if (!raw) {
    return {
      sections: {},
      hasTestAccount: false
    };
  }

  const sanitized = maskSecrets(raw);
  const sections = parseSections(sanitized);

  return {
    path: guidePath,
    raw: sanitized,
    sections,
    projectName: normalizeWhitespace(sections["project name"] ?? ""),
    pitch: normalizeWhitespace(sections["one sentence pitch"] ?? sections.pitch ?? ""),
    demoUrl: normalizeWhitespace(sections["demo url"] ?? ""),
    localRunCommands: listFromSection(sections["how to run locally"]),
    keyFeatures: listFromSection(sections["key features to show"] ?? sections["key features"]),
    suggestedFlow: listFromSection(sections["suggested demo flow"] ?? sections["demo flow"]),
    notes: sections.notes,
    hasTestAccount: Boolean(sections["test account"])
  };
}
