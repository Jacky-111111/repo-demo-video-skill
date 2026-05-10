import type { DemoPlan } from "./types.js";
import { cleanNarrationText } from "./sanitizeNarration.js";

export function generateNarrationScript(plan: DemoPlan): string {
  const featureNarration = plan.selectedFeatures
    .map((feature, index) => {
      const safeDescription = cleanNarrationText(feature.description);
      return `## Scene ${index + 2}: ${feature.name}

Show ${feature.route ?? "the relevant screen"}.

Narration:
"${safeDescription}"

Confidence: ${feature.confidence} (${feature.source})
`;
    })
    .join("\n");

  return `# Narration Script

## Scene 1: Opening

"${cleanNarrationText(plan.openingHook)}"

## Scene 1B: Introduction

"${plan.projectName} is ${cleanNarrationText(plan.tagline)} It is designed for ${cleanNarrationText(plan.targetAudience)}"

${featureNarration}
## Closing

"${cleanNarrationText(plan.closingPitch)}"

## Production Notes

- Overall confidence: ${plan.confidenceSummary.overall}
- Use neutral wording for uncertain claims.
- Do not read credentials, passwords, API keys, private tokens, or private user data aloud.
`;
}
