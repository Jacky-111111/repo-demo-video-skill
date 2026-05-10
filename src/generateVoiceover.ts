import path from "node:path";
import type { VoiceoverResult } from "./types.js";
import { writeText } from "./fileUtils.js";
import { cleanNarrationText } from "./sanitizeNarration.js";
import { MockTtsProvider } from "./tts/mockTts.js";
import { OpenAiTtsProvider } from "./tts/openaiTts.js";
import type { TtsProvider } from "./tts/types.js";

function narrationOnly(markdownScript: string): string {
  const narrationLines = markdownScript
    .split(/\r?\n/)
    .filter((line) => /^".*"$/.test(line.trim()))
    .map((line) => cleanNarrationText(line.trim().replace(/^"|"$/g, "")))
    .filter(Boolean);
  return narrationLines.join("\n\n");
}

function selectProvider(allowRealTts: boolean): { provider: TtsProvider; name: "mock" | "openai" } {
  if (!allowRealTts) {
    return { provider: new MockTtsProvider(), name: "mock" };
  }

  const requested = (process.env.TTS_PROVIDER || "mock").toLowerCase();
  if (requested === "openai") {
    return { provider: new OpenAiTtsProvider(), name: "openai" };
  }
  return { provider: new MockTtsProvider(), name: "mock" };
}

export async function generateVoiceover(narrationScript: string, outputDir: string, allowRealTts = true): Promise<VoiceoverResult> {
  const scriptPath = path.join(outputDir, "voiceover_script.txt");
  const instructionsPath = path.join(outputDir, "voiceover_instructions.md");
  const audioPath = path.join(outputDir, "voiceover.mp3");
  const text = narrationOnly(narrationScript);
  const { provider, name } = selectProvider(allowRealTts);

  await writeText(scriptPath, text || narrationScript);
  await writeText(
    instructionsPath,
    `# Voiceover Instructions

Current provider: ${name}

Real TTS enabled for this run: ${allowRealTts ? "yes" : "no"}

To generate real TTS with OpenAI:

- Set TTS_PROVIDER=openai.
- Set OPENAI_API_KEY in the environment.
- Optional: set OPENAI_TTS_MODEL, OPENAI_TTS_VOICE, or OPENAI_TTS_INSTRUCTIONS.
- The default model is gpt-4o-mini-tts and the default voice is coral.
- Do not include API keys or credentials in generated artifacts.
- Disclose to viewers when a voice is AI-generated.
`
  );

  const tts = await provider.synthesize({
    text: text || narrationScript,
    outputPath: audioPath
  });
  const artifacts = [scriptPath, instructionsPath];
  const warnings: string[] = [];

  if (tts.artifact) {
    artifacts.push(tts.artifact);
  }
  if (tts.warning) {
    warnings.push(tts.warning);
  }

  return {
    success: tts.success || name === "mock",
    mockMode: name === "mock",
    provider: name,
    artifacts,
    warnings
  };
}
