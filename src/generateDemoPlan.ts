import type { DemoAction, DemoPlan, DemoPlanStep, RepoAnalysis } from "./types.js";
import { combineConfidence } from "./fileUtils.js";

function actionSequenceForFeature(featureName: string, route?: string): DemoAction[] {
  const actions: DemoAction[] = [];
  if (route) {
    actions.push({
      type: "visit",
      route,
      confidence: "medium",
      source: "inferred route"
    });
  }

  actions.push({
    type: "assert-visible",
    text: featureName,
    confidence: "low",
    source: "fallback action"
  });

  return actions;
}

function planStepFromFeature(feature: RepoAnalysis["features"][number]): DemoPlanStep {
  return {
    title: feature.name,
    narrationGoal: feature.description,
    route: feature.route,
    actions: feature.actions?.length ? feature.actions : actionSequenceForFeature(feature.name, feature.route),
    confidence: feature.confidence,
    source: feature.source
  };
}

function overallConfidence(analysis: RepoAnalysis): DemoPlan["confidenceSummary"] {
  const selected = analysis.features.slice(0, 5);
  const values = [
    analysis.projectName.confidence,
    analysis.tagline.confidence,
    ...selected.map((feature) => feature.confidence)
  ];
  const overall = combineConfidence(values);
  const reasons: string[] = [];

  if (!analysis.demoUrl && !analysis.localUrl) {
    reasons.push("No demo URL or confident local URL is available, so browser recording may need manual work.");
  }
  if (selected.some((feature) => feature.confidence === "low")) {
    reasons.push("At least one selected feature is speculative.");
  }
  if (!analysis.metadata.readmePath) {
    reasons.push("README.md is missing, reducing product-story confidence.");
  }
  if (!analysis.config.config && !analysis.guide.path) {
    reasons.push("No DEMO_GUIDE.md or demo.config file is available.");
  }

  return {
    overall,
    shouldGenerateFinalPlan: overall !== "low" && selected.length > 0,
    reasons: reasons.length ? reasons : ["The selected claims are supported by explicit documentation or clear repository structure."]
  };
}

export function generateDemoPlan(analysis: RepoAnalysis): DemoPlan {
  const selectedFeatures = analysis.features.slice(0, 5);
  const browserSequence = selectedFeatures.map(planStepFromFeature);
  const projectName = analysis.projectName.value;

  return {
    projectName,
    tagline: analysis.tagline.value,
    targetAudience: analysis.targetAudience.value,
    coreProblem: analysis.coreProblem.value,
    openingHook: `Open by showing the problem ${projectName} solves: ${analysis.coreProblem.value}`,
    selectedFeatures,
    browserSequence,
    closingPitch: `Close by reinforcing how ${projectName} helps its target users move from problem to outcome faster.`,
    confidenceSummary: overallConfidence(analysis),
    missingInformation: analysis.missingInformation,
    sources: [
      analysis.config.path ? "demo.config" : undefined,
      analysis.guide.path ? "DEMO_GUIDE.md" : undefined,
      analysis.metadata.readmePath ? "README.md" : undefined,
      analysis.metadata.frameworkFiles.length ? "framework files" : undefined,
      analysis.routes.length ? "route files" : undefined,
      analysis.components.length ? "component files" : undefined,
      analysis.demoUrl ? analysis.demoUrl.source : undefined
    ].filter((item): item is string => Boolean(item))
  };
}

export function renderProjectSummary(analysis: RepoAnalysis, plan: DemoPlan): string {
  return `# ${plan.projectName}

${plan.tagline}

## Inferred Product Context

- Project name: ${analysis.projectName.value} (${analysis.projectName.confidence}, ${analysis.projectName.source})
- Tagline: ${analysis.tagline.value} (${analysis.tagline.confidence}, ${analysis.tagline.source})
- Target audience: ${analysis.targetAudience.value} (${analysis.targetAudience.confidence})
- Core problem: ${analysis.coreProblem.value} (${analysis.coreProblem.confidence})
- Demo URL: ${analysis.demoUrl ? `${analysis.demoUrl.value} (${analysis.demoUrl.confidence}, ${analysis.demoUrl.source})` : "not found"}
- Local URL: ${analysis.localUrl ? `${analysis.localUrl.value} (${analysis.localUrl.confidence}, ${analysis.localUrl.source})` : "not found"}
- Run command: ${analysis.runCommand ? `${analysis.runCommand.value} (${analysis.runCommand.confidence}, ${analysis.runCommand.source})` : "not found"}

## Framework And Structure

- Frameworks: ${analysis.metadata.frameworks.length ? analysis.metadata.frameworks.join(", ") : "not confidently detected"}
- Routes discovered: ${analysis.routes.length ? analysis.routes.map((route) => route.route).join(", ") : "none"}
- Component hints: ${analysis.components.length ? analysis.components.map((component) => component.name).slice(0, 12).join(", ") : "none"}

## Features

${analysis.features.length ? analysis.features.map((feature) => `- ${feature.name}: ${feature.description} (${feature.confidence}, ${feature.source})`).join("\n") : "- No features inferred."}

## Missing Or Uncertain Information

${analysis.missingInformation.length ? analysis.missingInformation.map((item) => `- ${item}`).join("\n") : "- No major gaps detected."}
`;
}

export function renderStoryboard(plan: DemoPlan): string {
  return `# Demo Storyboard

## Opening

${plan.openingHook}

## Walkthrough

${plan.browserSequence.map((step, index) => `${index + 1}. ${step.title}: ${step.narrationGoal}${step.route ? ` Route: ${step.route}.` : ""} Confidence: ${step.confidence}.`).join("\n")}

## Closing

${plan.closingPitch}
`;
}

export function renderManualRecordingGuide(analysis: RepoAnalysis, plan: DemoPlan): string {
  const startPoint = analysis.demoUrl?.value ?? analysis.localUrl?.value ?? "[open the app manually]";

  return `# Manual Recording Guide

Start at: ${startPoint}

## Before Recording

- Use a clean demo account if authentication is required.
- Do not show real user data, private admin pages, secrets, tokens, or environment files.
- Keep credentials off screen. If a test account exists, describe it as a demo account only.

## Recording Flow

1. Open the app and pause briefly on the first meaningful screen.
${plan.browserSequence.map((step, index) => `${index + 2}. Show ${step.title}${step.route ? ` at ${step.route}` : ""}. Narration goal: ${step.narrationGoal}`).join("\n")}
${plan.browserSequence.length + 2}. Close with the outcome: ${plan.closingPitch}

## Information To Confirm

${plan.missingInformation.length ? plan.missingInformation.map((item) => `- ${item}`).join("\n") : "- No missing information identified."}
`;
}
