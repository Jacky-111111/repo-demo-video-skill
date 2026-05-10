import path from "node:path";
import type { VoiceoverResult } from "./types.js";
import { writeText } from "./fileUtils.js";

export async function generateVoiceover(narrationScript: string, outputDir: string): Promise<VoiceoverResult> {
  const scriptPath = path.join(outputDir, "voiceover_script.txt");
  const instructionsPath = path.join(outputDir, "voiceover_instructions.md");

  await writeText(scriptPath, narrationScript);
  await writeText(
    instructionsPath,
    `# Voiceover Instructions

Mock mode is active. No TTS provider is called and no API key is required.

To add real TTS later:

- Read provider credentials from environment variables only.
- Suggested variables: OPENAI_API_KEY, ELEVENLABS_API_KEY, TTS_PROVIDER, TTS_VOICE.
- Save generated audio to output/voiceover.mp3 or output/voiceover.wav.
- Do not include API keys or credentials in generated artifacts.
`
  );

  return {
    success: true,
    mockMode: true,
    artifacts: [scriptPath, instructionsPath],
    warnings: ["Voiceover was generated in mock mode; no audio file was created."]
  };
}
