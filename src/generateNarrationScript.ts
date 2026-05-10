import type { DemoPlan } from "./types.js";

export function generateNarrationScript(plan: DemoPlan): string {
  const featureNarration = plan.selectedFeatures
    .map((feature, index) => {
      return `## Scene ${index + 2}: ${feature.name}

Show ${feature.route ?? "the relevant screen"}.

Narration:
"${feature.description}"

Confidence: ${feature.confidence} (${feature.source})
`;
    })
    .join("\n");

  return `# Narration Script

## Scene 1: Opening

"${plan.openingHook}"

## Scene 1B: Introduction

"${plan.projectName} is ${plan.tagline} It is designed for ${plan.targetAudience}"

${featureNarration}
## Closing

"${plan.closingPitch}"

## Production Notes

- Overall confidence: ${plan.confidenceSummary.overall}
- Use neutral wording for uncertain claims.
- Do not read credentials, passwords, API keys, private tokens, or private user data aloud.
`;
}
