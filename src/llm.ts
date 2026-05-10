export interface TextGenerationRequest {
  instructions: string;
  input: string;
  maxOutputTokens?: number;
}

export interface TextGenerationResult {
  success: boolean;
  provider: "openai";
  model: string;
  text?: string;
  warning?: string;
}

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

function extractResponseText(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  const objectPayload = payload as Record<string, unknown>;
  if (typeof objectPayload.output_text === "string") {
    return objectPayload.output_text;
  }

  const output = objectPayload.output;
  if (!Array.isArray(output)) {
    return undefined;
  }

  const parts: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const content = (item as Record<string, unknown>).content;
    if (!Array.isArray(content)) {
      continue;
    }

    for (const contentItem of content) {
      if (!contentItem || typeof contentItem !== "object") {
        continue;
      }

      const text = (contentItem as Record<string, unknown>).text;
      if (typeof text === "string") {
        parts.push(text);
      }
    }
  }

  return parts.join("\n").trim() || undefined;
}

export class OpenAiTextProvider {
  async generate(request: TextGenerationRequest): Promise<TextGenerationResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_SCRIPT_MODEL || process.env.OPENAI_MODEL || "gpt-5.4-mini";

    if (!apiKey) {
      return {
        success: false,
        provider: "openai",
        model,
        warning: "OPENAI_API_KEY is not set, so professional LLM script generation was skipped."
      };
    }

    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        instructions: request.instructions,
        input: request.input,
        max_output_tokens: request.maxOutputTokens ?? 2600
      })
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      return {
        success: false,
        provider: "openai",
        model,
        warning: `OpenAI script generation failed with ${response.status}: ${errorText.slice(0, 400)}`
      };
    }

    const payload = await response.json().catch(() => undefined);
    const text = extractResponseText(payload);

    if (!text) {
      return {
        success: false,
        provider: "openai",
        model,
        warning: "OpenAI script generation returned no readable output text."
      };
    }

    return {
      success: true,
      provider: "openai",
      model,
      text
    };
  }
}
