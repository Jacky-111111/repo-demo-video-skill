import path from "node:path";
import type { ProjectMetadata } from "./types.js";
import { extractUrls, listFiles, normalizeWhitespace, pathExists, readTextIfExists } from "./fileUtils.js";

const FRAMEWORK_FILES = [
  "next.config.js",
  "next.config.mjs",
  "next.config.ts",
  "vite.config.js",
  "vite.config.ts",
  "angular.json",
  "svelte.config.js",
  "svelte.config.ts",
  "astro.config.mjs",
  "nuxt.config.ts",
  "remix.config.js"
];

function extractReadmeTitle(readme: string): string | undefined {
  const title = readme.match(/^#\s+(.+?)\s*$/m)?.[1];
  return title ? normalizeWhitespace(title) : undefined;
}

function extractReadmeSummary(readme: string): string | undefined {
  const withoutTitle = readme.replace(/^#\s+.+?\s*$/m, "");
  const paragraph = withoutTitle
    .split(/\n\s*\n/)
    .map((block) => normalizeWhitespace(block.replace(/[#>*`]/g, "")))
    .find((block) => block.length > 40 && !block.toLowerCase().startsWith("installation"));

  return paragraph;
}

function detectFrameworks(packageJson: Record<string, unknown>, frameworkFiles: string[]): string[] {
  const deps = {
    ...(packageJson.dependencies as Record<string, string> | undefined),
    ...(packageJson.devDependencies as Record<string, string> | undefined)
  };
  const names = new Set<string>();

  if (deps.next || frameworkFiles.some((file) => file.includes("next.config"))) names.add("Next.js");
  if (deps.vite || frameworkFiles.some((file) => file.includes("vite.config"))) names.add("Vite");
  if (deps.react) names.add("React");
  if (deps.vue) names.add("Vue");
  if (deps["@angular/core"] || frameworkFiles.includes("angular.json")) names.add("Angular");
  if (deps.svelte || frameworkFiles.some((file) => file.includes("svelte.config"))) names.add("Svelte");
  if (deps.astro || frameworkFiles.some((file) => file.includes("astro.config"))) names.add("Astro");
  if (deps["@remix-run/react"] || frameworkFiles.includes("remix.config.js")) names.add("Remix");

  return [...names];
}

export async function discoverProjectMetadata(repoPath: string): Promise<ProjectMetadata> {
  const packagePath = path.join(repoPath, "package.json");
  const readmePath = path.join(repoPath, "README.md");
  const packageRaw = await readTextIfExists(packagePath);
  const readmeRaw = await readTextIfExists(readmePath);
  const sourceFiles = await listFiles(repoPath);
  const frameworkFiles: string[] = [];

  for (const file of FRAMEWORK_FILES) {
    if (await pathExists(path.join(repoPath, file))) {
      frameworkFiles.push(file);
    }
  }

  let packageJson: Record<string, unknown> = {};
  if (packageRaw) {
    try {
      packageJson = JSON.parse(packageRaw) as Record<string, unknown>;
    } catch {
      packageJson = {};
    }
  }

  return {
    repoPath,
    packageName: typeof packageJson.name === "string" ? packageJson.name : undefined,
    packageDescription: typeof packageJson.description === "string" ? packageJson.description : undefined,
    packageScripts: typeof packageJson.scripts === "object" && packageJson.scripts
      ? (packageJson.scripts as Record<string, string>)
      : {},
    packageKeywords: Array.isArray(packageJson.keywords) ? packageJson.keywords.filter((item): item is string => typeof item === "string") : [],
    readmePath: readmeRaw ? readmePath : undefined,
    readmeTitle: readmeRaw ? extractReadmeTitle(readmeRaw) : undefined,
    readmeSummary: readmeRaw ? extractReadmeSummary(readmeRaw) : undefined,
    readmeUrls: readmeRaw ? extractUrls(readmeRaw) : [],
    frameworks: detectFrameworks(packageJson, frameworkFiles),
    frameworkFiles,
    sourceFiles
  };
}
