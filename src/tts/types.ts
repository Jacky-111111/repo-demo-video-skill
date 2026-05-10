export interface TtsRequest {
  text: string;
  outputPath: string;
}

export interface TtsResult {
  success: boolean;
  provider: "mock" | "openai";
  artifact?: string;
  warning?: string;
}

export interface TtsProvider {
  synthesize(request: TtsRequest): Promise<TtsResult>;
}
