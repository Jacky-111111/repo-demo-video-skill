import type { BrowserRecordingResult, DemoPlan, RepoAnalysis, VideoTimingPlan } from "../types.js";
import { cleanNarrationText } from "../sanitizeNarration.js";

export interface DemoNarrationPromptInput {
  analysis: RepoAnalysis;
  plan: DemoPlan;
  timingPlan: VideoTimingPlan;
  recording?: BrowserRecordingResult;
}

function compactAnalysis(input: DemoNarrationPromptInput): unknown {
  const { analysis, plan, recording } = input;

  return {
    project: {
      name: plan.projectName,
      tagline: cleanNarrationText(plan.tagline),
      targetAudience: cleanNarrationText(plan.targetAudience),
      coreProblem: cleanNarrationText(plan.coreProblem),
      confidence: plan.confidenceSummary,
      sources: plan.sources
    },
    readme: {
      title: analysis.metadata.readme.title,
      summary: analysis.metadata.readme.summary,
      blockquoteSummary: analysis.metadata.readme.blockquoteSummary,
      features: analysis.metadata.readme.features,
      usageSteps: analysis.metadata.readme.usageSteps
    },
    package: {
      name: analysis.metadata.packageName,
      description: analysis.metadata.packageDescription,
      frameworks: analysis.metadata.frameworks
    },
    selectedFeatures: plan.selectedFeatures.map((feature) => ({
      name: feature.name,
      description: cleanNarrationText(feature.description),
      importance: feature.importance,
      confidence: feature.confidence,
      route: feature.route,
      source: feature.source
    })),
    browserSequence: plan.browserSequence.map((step) => ({
      title: step.title,
      narrationGoal: cleanNarrationText(step.narrationGoal),
      route: step.route,
      confidence: step.confidence,
      actions: step.actions.map((action) => ({
        type: action.type,
        text: action.text,
        route: action.route,
        confidence: action.confidence
      }))
    })),
    browserObservations: recording?.observations ?? [],
    timingPlan: input.timingPlan,
    missingInformation: plan.missingInformation
  };
}

export function buildDemoNarrationPrompt(input: DemoNarrationPromptInput): { instructions: string; userInput: string } {
  const targetDuration = input.timingPlan.targetDurationSeconds;
  const style = input.analysis.config.config?.video?.style ?? "polished startup product demo";
  const voice = input.analysis.config.config?.video?.voice ?? "professional, clear, warm, confident";
  const sceneList = input.timingPlan.sceneTimings
    .map((scene, index) => `  ${index + 1}. ${scene.title}: about ${scene.durationSeconds}s, up to ${scene.maxNarrationWords} spoken words`)
    .join("\n");

  const instructions = `You are a senior product demo scriptwriter.

Write a narrated product demo script from repository analysis.

Think before writing, then write the final script only. Do not expose your reasoning.

Your goals:
- Understand what the product is, who it helps, and what problem it solves.
- Turn repository facts into a professional product pitch, not a README summary.
- Use a natural spoken style suitable for a ${targetDuration}-second demo.
- Respect the available scene count and visual material. Do not write more walkthrough scenes than the timing plan provides.
- Keep the final spoken narration around ${input.timingPlan.minNarrationWords}-${input.timingPlan.maxNarrationWords} words, targeting ${input.timingPlan.targetNarrationWords} words.
- Use exactly ${input.timingPlan.sceneCount} scenes, matching this timing plan:
${sceneList}
- Make the walkthrough feel intentional: opening problem, positioning, feature proof, and closing pitch.
- Prefer user value over implementation trivia.
- Use conservative wording for medium or low-confidence claims.
- If only a few features are available, write shorter and deeper rather than inventing extra material.

Avoid:
- Markdown badges, shield text, raw URLs, install commands, repo maintenance metadata, or implementation details unless they are central to product value.
- Inventing features not supported by the provided analysis.
- Mentioning real passwords, API keys, private tokens, private data, or credentials.
- Overclaiming production readiness, customers, metrics, security, integrations, or business impact without evidence.

Output format:
- Markdown.
- Start with "# Narration Script".
- Use sections like "## Scene 1: Opening".
- Put every spoken narration paragraph on its own line wrapped in double quotes.
- Include short "Visual:" lines to tell the recorder what should be on screen.
- End with "## Production Notes" and include confidence caveats.

Voice: ${voice}
Style: ${style}`;

  const userInput = `Repository demo context:

${JSON.stringify(compactAnalysis(input), null, 2)}

Write the final professional narration script now.`;

  return { instructions, userInput };
}
