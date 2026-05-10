import { writeFile } from "node:fs/promises";
import type { TtsProvider, TtsRequest, TtsResult } from "./types.js";

const OPENAI_SPEECH_URL = "https://api.openai.com/v1/audio/speech";

export class OpenAiTtsProvider implements TtsProvider {
  async synthesize(request: TtsRequest): Promise<TtsResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        provider: "openai",
        warning: "TTS_PROVIDER=openai was requested but OPENAI_API_KEY is not set."
      };
    }

    const model = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
    const voice = process.env.OPENAI_TTS_VOICE || process.env.TTS_VOICE || "coral";
    const instructions =
      process.env.OPENAI_TTS_INSTRUCTIONS ||
      "Speak like a polished product demo narrator: clear, warm, concise, and confident.";

    const response = await fetch(OPENAI_SPEECH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        voice,
        input: request.text.slice(0, 4096),
        instructions,
        response_format: "mp3"
      })
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      return {
        success: false,
        provider: "openai",
        warning: `OpenAI TTS request failed with ${response.status}: ${errorText.slice(0, 300)}`
      };
    }

    const audio = Buffer.from(await response.arrayBuffer());
    await writeFile(request.outputPath, audio);

    return {
      success: true,
      provider: "openai",
      artifact: request.outputPath
    };
  }
}
