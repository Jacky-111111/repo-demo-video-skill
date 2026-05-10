# repo-demo-video-skill

An AI skill that turns a GitHub repo into a narrated product demo video by analyzing README, source code, optional demo guides, and optional demo configuration.

This project is designed as a practical AI coding agent workflow, not a one-off script. It reads the repository as the source of truth, builds a confidence-scored demo plan, writes narration and recording guides, and optionally uses Playwright plus `ffmpeg` to capture and compose video assets when the environment supports it.

## What It Does

The skill analyzes a local project folder and generates:

- a project summary
- a confidence-scored demo plan draft
- a final demo plan when confidence is high enough
- a narration script
- a storyboard
- a manual recording guide
- optional browser screenshots or recordings
- optional video composition notes or `demo_video.mp4`

The workflow is intentionally graceful. If automation cannot safely run the app or record the browser, the written demo artifacts are still produced.

## Input Priority

Users do not need to provide a perfect `demo.config.json`.

The analyzer uses this priority order:

1. `demo.config.json` or `demo.config.yaml`
2. `DEMO_GUIDE.md`
3. `README.md`
4. `package.json`, framework files, route files, component names, page titles, and source code structure
5. Browser exploration of a deployed or locally running app
6. Fallback assumptions with confidence scores

Core principle:

```text
README + repo code = primary source
DEMO_GUIDE.md = recommended human-friendly guide
demo.config.json = optional machine-friendly enhancement
```

## Required And Optional Inputs

Required:

- `--repo`, pointing to a local repository path

Optional:

- `README.md`
- `DEMO_GUIDE.md`
- `demo.config.json`
- `demo.config.yaml`
- deployed demo URL via `--url`

GitHub repository URL cloning is planned, but the MVP expects a local clone path.

## Install

```bash
npm install
```

Playwright is listed as an optional dependency. If it is not installed or browsers are unavailable, the CLI still produces planning artifacts and records the issue in `output/run_report.json`.

## Run

```bash
npm run demo -- --repo ./path-to-repo
```

With an explicit config:

```bash
npm run demo -- --repo ./path-to-repo --config ./path-to-demo.config.json
```

With a deployed demo URL:

```bash
npm run demo -- --repo ./path-to-repo --url https://example.com
```

Draft-only mode:

```bash
npm run demo -- --repo ./path-to-repo --mode draft
```

Full mode:

```bash
npm run demo -- --repo ./path-to-repo --mode full
```

## Output Files

Generated files are written to the target repository's `output/` folder:

```text
output/
├── project_summary.md
├── demo_plan.draft.json
├── demo_plan.json
├── narration_script.md
├── demo_storyboard.md
├── manual_recording_guide.md
├── run_report.json
├── recordings/
└── demo_video.mp4
```

`demo_plan.json` is only written when confidence is high enough. `demo_video.mp4` is only written when browser recording, real voiceover audio, and `ffmpeg` are available.

## DEMO_GUIDE.md

`DEMO_GUIDE.md` is optional, but it is the recommended way for humans to guide the demo without maintaining a strict machine config.

See [examples/DEMO_GUIDE.example.md](examples/DEMO_GUIDE.example.md).

Recommended sections:

```markdown
# Demo Guide

## Project Name
CarbonTrack

## One-Sentence Pitch
A carbon accounting platform that helps students track eco-friendly actions.

## Demo URL
https://carbontrackapp.com

## How to Run Locally
npm install
npm run dev

## Key Features to Show
1. User carbon action logging
2. Carbon credit calculation
3. Leaderboard
4. Rewards store

## Suggested Demo Flow
1. Open homepage
2. Show login/register
3. Log an eco-friendly action
4. Show calculated carbon credits
5. Show leaderboard

## Test Account
email: demo@example.com
password: demo123

## Notes
Avoid showing private admin pages or real user data.
```

The skill masks secrets and avoids reading real passwords into narration.

## demo.config

`demo.config.json` or `demo.config.yaml` is optional. It overrides weaker inferred information when present.

See [examples/demo.config.example.json](examples/demo.config.example.json).

Use config when you want precise routes, browser actions, video style, duration, or a known deployed demo URL.

## Confidence Model

Every important inferred item receives one of:

- `high`: explicit docs or config
- `medium`: clear package metadata, route files, framework files, or component names
- `low`: speculative fallback

If the plan contains important low-confidence assumptions, the CLI writes `demo_plan.draft.json` and explains what needs confirmation instead of pretending certainty.

## Safety Model

The skill is conservative by design:

- prefers read-only repository analysis
- writes generated artifacts only to `output/`
- treats `demo.config` as optional
- avoids destructive commands
- avoids deployment commands
- does not expose secrets, API keys, `.env` values, private tokens, private user data, or credentials
- does not include real passwords in narration or video
- skips local startup when run commands are uncertain

## MVP Scope

Implemented now:

- README analysis
- optional `DEMO_GUIDE.md`
- optional JSON/YAML demo config
- package metadata and framework detection
- route and component inference
- confidence-scored feature inference
- demo plan draft generation
- narration script generation
- storyboard and manual recording guide
- Playwright browser capture when a URL is available
- mock voiceover module
- graceful `ffmpeg` composition notes

Planned extensions:

- GitHub repo URL cloning
- safer automatic local app startup
- deeper browser interaction
- real OpenAI TTS or ElevenLabs integration
- captions
- multiple video styles
- automatic feature discovery from UI exploration
- human review UI for `demo_plan.draft.json`
