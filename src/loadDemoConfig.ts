import path from "node:path";
import type { DemoConfig, LoadedDemoConfig } from "./types.js";
import { pathExists, readTextIfExists } from "./fileUtils.js";

async function parseYaml(text: string): Promise<unknown> {
  try {
    const yamlModule = await import("yaml");
    return yamlModule.parse(text);
  } catch {
    return parseVerySimpleYaml(text);
  }
}

function parseVerySimpleYaml(text: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.+?)\s*$/);
    if (match) {
      result[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
  return result;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeConfig(value: unknown): DemoConfig {
  if (!isObject(value)) {
    throw new Error("demo config must contain an object at the top level");
  }
  return value as DemoConfig;
}

export async function loadDemoConfig(repoPath: string, explicitPath?: string): Promise<LoadedDemoConfig> {
  const warnings: string[] = [];
  const candidates = explicitPath
    ? [path.resolve(explicitPath)]
    : [
        path.join(repoPath, "demo.config.json"),
        path.join(repoPath, "demo.config.yaml"),
        path.join(repoPath, "demo.config.yml")
      ];

  for (const candidate of candidates) {
    if (!(await pathExists(candidate))) {
      continue;
    }

    const raw = await readTextIfExists(candidate);
    if (!raw) {
      continue;
    }

    try {
      const parsed = candidate.endsWith(".json") ? JSON.parse(raw) : await parseYaml(raw);
      return {
        path: candidate,
        config: normalizeConfig(parsed),
        warnings
      };
    } catch (error) {
      warnings.push(`Could not parse ${candidate}: ${error instanceof Error ? error.message : String(error)}`);
      return {
        path: candidate,
        warnings
      };
    }
  }

  return { warnings };
}
