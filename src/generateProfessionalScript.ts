import type { BrowserRecordingResult, DemoPlan, RepoAnalysis, VideoTimingPlan } from "./types.js";
import { generateNarrationScript } from "./generateNarrationScript.js";
import { OpenAiTextProvider } from "./llm.js";
import { buildDemoNarrationPrompt } from "./prompts/demoNarrationPrompt.js";
import { cleanNarrationText, isBadNarrationText } from "./sanitizeNarration.js";

export interface ScriptQualityReport {
  provider: "template" | "openai";
  model?: string;
  usedLlm: boolean;
  usedFallback: boolean;
  fallbackReason?: string;
  warnings: string[];
}

export interface ProfessionalScriptResult {
  script: string;
  draftScript: string;
  qualityReport: ScriptQualityReport;
}

function hasUsableQuotedNarration(script: string): boolean {
  const quotedLines = script
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^".{20,}"$/.test(line));

  return quotedLines.length >= 3;
}

function isBadScript(script: string): boolean {
  const cleaned = cleanNarrationText(script);
  return isBadNarrationText(script) || cleaned.length < 300 || !hasUsableQuotedNarration(script);
}

function shouldUseOpenAiScriptWriter(): boolean {
  const provider = (process.env.SCRIPT_PROVIDER || process.env.DEMO_SCRIPT_PROVIDER || "openai").toLowerCase();
  return provider !== "template" && provider !== "mock" && provider !== "none";
}

export async function generateProfessionalScript(
  analysis: RepoAnalysis,
  plan: DemoPlan,
  timingPlan: VideoTimingPlan,
  recording?: BrowserRecordingResult
): Promise<ProfessionalScriptResult> {
  const draftScript = generateNarrationScript(plan);
  const warnings: string[] = [];

  if (!shouldUseOpenAiScriptWriter()) {
    return {
      script: draftScript,
      draftScript,
      qualityReport: {
        provider: "template",
        usedLlm: false,
        usedFallback: true,
        fallbackReason: "SCRIPT_PROVIDER requested template/mock/none mode.",
        warnings
      }
    };
  }

  const { instructions, userInput } = buildDemoNarrationPrompt({ analysis, plan, timingPlan, recording });
  const provider = new OpenAiTextProvider();
  const result = await provider.generate({
    instructions,
    input: userInput
  });

  if (!result.success || !result.text) {
    return {
      script: draftScript,
      draftScript,
      qualityReport: {
        provider: "openai",
        model: result.model,
        usedLlm: false,
        usedFallback: true,
        fallbackReason: result.warning ?? "OpenAI script generation failed.",
        warnings: result.warning ? [result.warning] : warnings
      }
    };
  }

  if (isBadScript(result.text)) {
    warnings.push("OpenAI script output failed the narration quality gate, so the template draft was used.");
    return {
      script: draftScript,
      draftScript,
      qualityReport: {
        provider: "openai",
        model: result.model,
        usedLlm: true,
        usedFallback: true,
        fallbackReason: "Generated script did not contain enough clean quoted narration or looked polluted by Markdown/metadata.",
        warnings
      }
    };
  }

  return {
    script: result.text,
    draftScript,
    qualityReport: {
      provider: "openai",
      model: result.model,
      usedLlm: true,
      usedFallback: false,
      warnings
    }
  };
}
