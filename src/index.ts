#!/usr/bin/env node
import path from "node:path";
import { analyzeRepo } from "./analyzeRepo.js";
import { composeVideo } from "./composeVideo.js";
import { generateDemoPlan, renderManualRecordingGuide, renderProjectSummary, renderStoryboard } from "./generateDemoPlan.js";
import { generateNarrationScript } from "./generateNarrationScript.js";
import { generateVoiceover } from "./generateVoiceover.js";
import { isProbablyGitHubUrl, writeJson, writeText } from "./fileUtils.js";
import { recordBrowserDemo } from "./recordBrowserDemo.js";
import type { CliOptions, DemoMode } from "./types.js";

function parseArgs(argv: string[]): CliOptions {
  const options: Partial<CliOptions> = {
    mode: "full"
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === "--repo" && next) {
      options.repo = next;
      index += 1;
    } else if (arg === "--config" && next) {
      options.config = next;
      index += 1;
    } else if (arg === "--url" && next) {
      options.url = next;
      index += 1;
    } else if (arg === "--mode" && next) {
      options.mode = next as DemoMode;
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      throw new Error("help");
    }
  }

  if (!options.repo) {
    throw new Error("Missing required --repo argument.");
  }
  if (options.mode !== "draft" && options.mode !== "full") {
    throw new Error("--mode must be draft or full.");
  }

  return options as CliOptions;
}

function usage(): string {
  return `Usage:
  npm run demo -- --repo ./path-to-repo
  npm run demo -- --repo ./path-to-repo --config ./demo.config.json
  npm run demo -- --repo ./path-to-repo --url https://example.com
  npm run demo -- --repo ./path-to-repo --mode draft
  npm run demo -- --repo ./path-to-repo --mode full`;
}

async function main(): Promise<void> {
  let options: CliOptions;

  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.log(usage());
    if (error instanceof Error && error.message !== "help") {
      process.exitCode = 1;
    }
    return;
  }

  if (isProbablyGitHubUrl(options.repo)) {
    console.error("GitHub URL cloning is planned for a future version. Please pass a local clone path with --repo for this MVP.");
    process.exitCode = 1;
    return;
  }

  const analysis = await analyzeRepo(options);
  const plan = generateDemoPlan(analysis);
  const narrationScript = generateNarrationScript(plan);
  const outputDir = path.join(analysis.repoPath, "output");

  await writeText(path.join(outputDir, "project_summary.md"), renderProjectSummary(analysis, plan));
  await writeJson(path.join(outputDir, "demo_plan.draft.json"), plan);
  await writeText(path.join(outputDir, "narration_script.md"), narrationScript);
  await writeText(path.join(outputDir, "demo_storyboard.md"), renderStoryboard(plan));
  await writeText(path.join(outputDir, "manual_recording_guide.md"), renderManualRecordingGuide(analysis, plan));

  if (plan.confidenceSummary.shouldGenerateFinalPlan) {
    await writeJson(path.join(outputDir, "demo_plan.json"), plan);
  }

  const voiceover = await generateVoiceover(narrationScript, outputDir);
  const recording = options.mode === "draft"
    ? {
        attempted: false,
        success: false,
        artifacts: [],
        observations: [],
        warnings: ["Draft mode skipped browser recording."]
      }
    : await recordBrowserDemo(analysis.demoUrl?.value ?? analysis.localUrl?.value, plan, outputDir);
  const composition = options.mode === "full" ? await composeVideo(outputDir) : { success: false, warnings: ["Draft mode skipped video composition."] };

  await writeJson(path.join(outputDir, "run_report.json"), {
    outputDir,
    finalPlanGenerated: plan.confidenceSummary.shouldGenerateFinalPlan,
    voiceover,
    recording,
    composition,
    warnings: [...analysis.warnings, ...voiceover.warnings, ...recording.warnings, ...composition.warnings]
  });

  console.log(`Generated demo artifacts in ${outputDir}`);
  console.log(`Overall confidence: ${plan.confidenceSummary.overall}`);
  if (!plan.confidenceSummary.shouldGenerateFinalPlan) {
    console.log("Final demo_plan.json was skipped because the draft needs confirmation.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
