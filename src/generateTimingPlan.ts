import type { DemoPlan, RepoAnalysis, SceneTiming, VideoTimingPlan } from "./types.js";

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function round(value: number): number {
  return Math.round(value);
}

function allocateSceneTimings(plan: DemoPlan, targetDurationSeconds: number, spokenWordsPerSecond: number): SceneTiming[] {
  const featureSteps = plan.browserSequence.slice(0, 5);
  const rawScenes = [
    { title: "Opening", weight: 0.9 },
    ...featureSteps.map((step) => ({
      title: step.title,
      weight: step.confidence === "high" ? 1.25 : step.confidence === "medium" ? 1.1 : 0.9
    })),
    { title: "Closing", weight: 0.85 }
  ];

  if (rawScenes.length === 2) {
    rawScenes.splice(1, 0, { title: "Product Overview", weight: 1.1 });
  }

  const totalWeight = rawScenes.reduce((sum, scene) => sum + scene.weight, 0);
  let remaining = targetDurationSeconds;

  return rawScenes.map((scene, index) => {
    const isLast = index === rawScenes.length - 1;
    const durationSeconds = isLast ? remaining : clamp(round((scene.weight / totalWeight) * targetDurationSeconds), 8, 18);
    remaining -= durationSeconds;
    return {
      title: scene.title,
      durationSeconds,
      maxNarrationWords: Math.max(12, round(durationSeconds * spokenWordsPerSecond))
    };
  });
}

export function generateTimingPlan(analysis: RepoAnalysis, plan: DemoPlan): VideoTimingPlan {
  const configuredDuration = analysis.config.config?.video?.durationSeconds;
  const featureCount = Math.min(plan.selectedFeatures.length, plan.browserSequence.length || plan.selectedFeatures.length, 5);
  const sceneCount = Math.max(3, featureCount + 2);
  const naturalDuration = sceneCount * 11;
  const targetDurationSeconds = configuredDuration
    ? clamp(configuredDuration, 30, 180)
    : clamp(naturalDuration, featureCount <= 2 ? 40 : 50, 75);
  const spokenWordsPerSecond = 2.2;
  const targetNarrationWords = round(targetDurationSeconds * spokenWordsPerSecond);
  const sceneTimings = allocateSceneTimings(plan, targetDurationSeconds, spokenWordsPerSecond);
  const pacingWarnings: string[] = [];

  if (featureCount <= 2) {
    pacingWarnings.push("Only a small number of showable features were found, so the script should stay short and focused.");
  }
  if (plan.browserSequence.length < plan.selectedFeatures.length) {
    pacingWarnings.push("Some selected features do not have corresponding browser scenes; avoid writing extra walkthrough beats for them.");
  }
  if (configuredDuration && configuredDuration > naturalDuration + 35) {
    pacingWarnings.push("Configured video duration is long relative to available scenes; the script should avoid filler and the recorder may need longer holds.");
  }

  return {
    targetDurationSeconds,
    minDurationSeconds: Math.max(25, targetDurationSeconds - 10),
    maxDurationSeconds: targetDurationSeconds + 10,
    targetNarrationWords,
    minNarrationWords: Math.max(40, targetNarrationWords - 25),
    maxNarrationWords: targetNarrationWords + 25,
    spokenWordsPerSecond,
    sceneCount: sceneTimings.length,
    featuresToCover: featureCount,
    sceneTimings,
    pacingWarnings
  };
}
