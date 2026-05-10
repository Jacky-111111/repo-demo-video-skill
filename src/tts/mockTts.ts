import type { TtsProvider } from "./types.js";

export class MockTtsProvider implements TtsProvider {
  async synthesize(): Promise<{ success: false; provider: "mock"; warning: string }> {
    return {
      success: false,
      provider: "mock",
      warning: "Mock TTS mode is active; no audio file was created."
    };
  }
}
