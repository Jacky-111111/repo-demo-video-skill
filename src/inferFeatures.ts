import path from "node:path";
import type { DemoConfig, DemoFeature, DemoGuide, InferredRoute, ProjectMetadata } from "./types.js";
import { confidenceRank, normalizeWhitespace, readTextIfExists, titleFromSlug, uniqueBy } from "./fileUtils.js";

function importanceFromIndex(index: number): "high" | "medium" | "low" {
  if (index < 3) return "high";
  if (index < 6) return "medium";
  return "low";
}

function routeForFeature(name: string, routes: InferredRoute[]): string | undefined {
  const normalized = name.toLowerCase();
  return routes.find((route) => normalized.includes(route.route.replace("/", "").toLowerCase()))?.route;
}

async function featuresFromReadme(metadata: ProjectMetadata, routes: InferredRoute[]): Promise<DemoFeature[]> {
  if (!metadata.readmePath) {
    return [];
  }

  const readme = await readTextIfExists(metadata.readmePath);
  if (!readme) {
    return [];
  }

  const featureSection = readme.match(/^##\s+(?:features|key features|what it does|capabilities)\s*$([\s\S]*?)(?=^##\s+|\s*$)/im)?.[1];
  if (!featureSection) {
    return [];
  }

  return featureSection
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*]|\d+[.)])\s+/, "").trim())
    .filter((line) => line.length > 4 && line.length < 180)
    .slice(0, 8)
    .map((line, index) => {
      const name = normalizeWhitespace(line.split(/[:.]/)[0] ?? line);
      return {
        name,
        description: normalizeWhitespace(line),
        importance: importanceFromIndex(index),
        confidence: "high" as const,
        source: "README.md feature section",
        route: routeForFeature(name, routes)
      };
    });
}

export async function inferFeatures(
  config: DemoConfig | undefined,
  guide: DemoGuide,
  metadata: ProjectMetadata,
  routes: InferredRoute[]
): Promise<DemoFeature[]> {
  const features: DemoFeature[] = [];

  for (const feature of config?.features ?? []) {
    features.push({
      ...feature,
      description: feature.description || feature.name,
      importance: feature.importance ?? "high",
      confidence: "high",
      source: "demo.config"
    });
  }

  for (const [index, feature] of (guide.keyFeatures ?? []).entries()) {
    features.push({
      name: normalizeWhitespace(feature.split(/[:.]/)[0] ?? feature),
      description: normalizeWhitespace(feature),
      importance: importanceFromIndex(index),
      confidence: "high",
      source: "DEMO_GUIDE.md",
      route: routeForFeature(feature, routes)
    });
  }

  features.push(...(await featuresFromReadme(metadata, routes)));

  for (const route of routes.slice(0, 8)) {
    const name = route.route === "/" ? "Homepage" : titleFromSlug(path.basename(route.route));
    features.push({
      name,
      description: `Show the ${name.toLowerCase()} experience.`,
      importance: route.route === "/" ? "high" : "medium",
      confidence: "medium",
      source: `route file: ${route.sourceFile}`,
      route: route.route
    });
  }

  for (const keyword of metadata.packageKeywords.slice(0, 4)) {
    features.push({
      name: titleFromSlug(keyword),
      description: `Highlight the project's ${keyword} capability or focus area.`,
      importance: "low",
      confidence: "low",
      source: "package.json keywords"
    });
  }

  return uniqueBy(features, (feature) => feature.name)
    .sort((left, right) => confidenceRank(right.confidence) - confidenceRank(left.confidence))
    .slice(0, 12);
}
