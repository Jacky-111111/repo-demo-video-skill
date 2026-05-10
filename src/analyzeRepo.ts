import path from "node:path";
import type { CliOptions, Evidence, RepoAnalysis } from "./types.js";
import { discoverProjectMetadata } from "./discoverProjectMetadata.js";
import { inferFeatures } from "./inferFeatures.js";
import { inferComponents, inferRoutes } from "./inferRoutes.js";
import { loadDemoConfig } from "./loadDemoConfig.js";
import { loadDemoGuide } from "./loadDemoGuide.js";
import { extractUrls, normalizeWhitespace, pathExists } from "./fileUtils.js";
import { chooseSafeNarrationText } from "./sanitizeNarration.js";

function evidence<T>(value: T, confidence: Evidence<T>["confidence"], source: string, notes?: string): Evidence<T> {
  return { value, confidence, source, notes };
}

function firstNonEmpty(values: Array<Evidence<string> | undefined>, fallback: Evidence<string>): Evidence<string> {
  return values.find((item) => item && normalizeWhitespace(item.value)) ?? fallback;
}

function isUsableDemoUrl(url: string): boolean {
  return !/github\.com|npmjs\.com|localhost|127\.0\.0\.1|example\.com|example\.org|example\.net|your-project|your-domain|placeholder/i.test(url);
}

function selectDemoUrl(optionsUrl: string | undefined, configUrl: string | undefined, guideUrl: string | undefined, readmeUrls: string[]): Evidence<string> | undefined {
  if (optionsUrl) return evidence(optionsUrl, "high", "--url argument");
  if (configUrl) return evidence(configUrl, "high", "demo.config");
  if (guideUrl) return evidence(guideUrl, "high", "DEMO_GUIDE.md");

  const nonRepoUrl = readmeUrls.find(isUsableDemoUrl);
  if (nonRepoUrl) return evidence(nonRepoUrl, "medium", "README.md URL");

  return undefined;
}

function inferRunCommand(configStart: string | undefined, scripts: Record<string, string>): Evidence<string> | undefined {
  if (configStart) return evidence(configStart, "high", "demo.config run.start");
  if (scripts.dev) return evidence("npm run dev", "medium", "package.json scripts.dev");
  if (scripts.start) return evidence("npm start", "medium", "package.json scripts.start");
  if (scripts.preview) return evidence("npm run preview", "low", "package.json scripts.preview");
  return undefined;
}

function inferLocalUrl(configLocalUrl: string | undefined, readmeText: string | undefined, scripts: Record<string, string>): Evidence<string> | undefined {
  if (configLocalUrl) return evidence(configLocalUrl, "high", "demo.config run.localUrl");

  const readmeLocalUrl = readmeText ? extractUrls(readmeText).find((url) => /localhost|127\.0\.0\.1/.test(url)) : undefined;
  if (readmeLocalUrl) return evidence(readmeLocalUrl, "high", "README.md");

  const allScripts = Object.values(scripts).join(" ");
  if (/vite|5173/.test(allScripts)) return evidence("http://localhost:5173", "medium", "Vite convention");
  if (/next|3000|react-scripts|remix/.test(allScripts)) return evidence("http://localhost:3000", "medium", "framework convention");

  return undefined;
}

export async function analyzeRepo(options: CliOptions): Promise<RepoAnalysis> {
  const repoPath = path.resolve(options.repo);

  if (!(await pathExists(repoPath))) {
    throw new Error(`Repository path does not exist: ${repoPath}`);
  }

  const config = await loadDemoConfig(repoPath, options.config);
  const guide = await loadDemoGuide(repoPath);
  const metadata = await discoverProjectMetadata(repoPath);
  const routes = inferRoutes(repoPath, metadata.sourceFiles);
  const components = inferComponents(repoPath, metadata.sourceFiles);
  const features = await inferFeatures(config.config, guide, metadata, routes);
  const readmeText = metadata.readmePath ? await import("./fileUtils.js").then((module) => module.readTextIfExists(metadata.readmePath!)) : undefined;

  const projectName = firstNonEmpty(
    [
      config.config?.projectName ? evidence(config.config.projectName, "high", "demo.config") : undefined,
      guide.projectName ? evidence(guide.projectName, "high", "DEMO_GUIDE.md") : undefined,
      metadata.readmeTitle ? evidence(metadata.readmeTitle, "high", "README.md title") : undefined,
      metadata.packageName ? evidence(metadata.packageName, "medium", "package.json name") : undefined
    ],
    evidence(path.basename(repoPath), "low", "repository folder name")
  );

  const tagline = firstNonEmpty(
    [
      config.config?.tagline ? evidence(config.config.tagline, "high", "demo.config") : undefined,
      guide.pitch ? evidence(guide.pitch, "high", "DEMO_GUIDE.md") : undefined,
      metadata.readmeSummary ? evidence(metadata.readmeSummary, "high", "README.md summary") : undefined,
      metadata.packageDescription ? evidence(metadata.packageDescription, "medium", "package.json description") : undefined
    ],
    evidence("A software project with a product demo opportunity.", "low", "fallback assumption")
  );

  const safeTagline = chooseSafeNarrationText(
    [
      tagline.value,
      guide.pitch,
      metadata.readme.blockquoteSummary,
      metadata.readme.summary,
      metadata.packageDescription
    ],
    "A software project with a product demo opportunity."
  );
  const sanitizedTagline = evidence(safeTagline, tagline.confidence, tagline.source, tagline.notes);

  const targetAudience = evidence(
    "Users described by the README and primary feature set.",
    metadata.readmeSummary || guide.pitch ? "medium" : "low",
    metadata.readmeSummary ? "README.md" : "fallback assumption",
    "Add a Target Audience section to DEMO_GUIDE.md for higher confidence."
  );

  const coreProblem = evidence(
    sanitizedTagline.value,
    sanitizedTagline.confidence,
    sanitizedTagline.source,
    tagline.confidence === "low" ? "Add a clearer one-sentence pitch to README.md or DEMO_GUIDE.md." : undefined
  );

  const demoUrl = selectDemoUrl(options.url, config.config?.demoUrl, guide.demoUrl, metadata.readmeUrls);
  const runCommand = inferRunCommand(config.config?.run?.start, metadata.packageScripts);
  const localUrl = inferLocalUrl(config.config?.run?.localUrl, readmeText, metadata.packageScripts);
  const missingInformation: string[] = [];

  if (!metadata.readmePath) missingInformation.push("README.md was not found.");
  if (!guide.path) missingInformation.push("DEMO_GUIDE.md was not found; create one to guide the demo story.");
  if (!config.path) missingInformation.push("demo.config.json or demo.config.yaml was not found; this is optional.");
  if (!demoUrl && !localUrl) missingInformation.push("No deployed demo URL or confident local URL was found.");
  if (features.length === 0) missingInformation.push("No features could be inferred from config, guide, README, routes, or package metadata.");

  return {
    repoPath,
    config,
    guide,
    metadata,
    projectName,
    tagline: sanitizedTagline,
    targetAudience,
    coreProblem,
    demoUrl,
    runCommand,
    localUrl,
    features,
    routes,
    components,
    missingInformation,
    warnings: config.warnings
  };
}
