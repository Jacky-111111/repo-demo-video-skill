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
- optional OpenAI TTS voiceover
- optional video composition notes, `demo_video.html`, or `demo_video.mp4`

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

## Local Environment Requirements

Install only the tools you need for the level of output you want.

### 1. Minimum: analysis and draft artifacts

Required:

- Node.js 20 or newer
- npm

Check your local versions:

```bash
node -v
npm -v
```

This is enough to generate:

- `project_summary.md`
- `demo_plan.draft.json`
- `narration_script.md`
- `demo_storyboard.md`
- `manual_recording_guide.md`
- `run_report.json`

Run draft mode when you only want repo analysis and written demo assets:

```bash
npm run demo -- --repo ./path-to-repo --mode draft
```

Draft mode does not call real TTS, even if `.env` contains an API key.

### 2. Browser recording: screenshots and `.webm`

Required in addition to Node/npm:

- Playwright
- Playwright Chromium browser

Install project dependencies and the browser runtime:

```bash
npm install
npx playwright install chromium
```

This enables browser capture when you provide a deployed URL or a confident local URL:

```bash
npm run demo -- --repo ./path-to-repo --url https://example.com --mode full
```

Browser recordings and screenshots are written under:

```text
demoOutput-YYYY-MM-DD-HHMMSS/recordings/
```

If Playwright or Chromium is missing, the CLI still generates the written artifacts and records the missing dependency in `demoOutput-YYYY-MM-DD-HHMMSS/run_report.json`.

### 3. Final MP4 composition

Required in addition to browser recording:

- `ffmpeg` available on `PATH`
- a real voiceover audio file, such as `demoOutput-YYYY-MM-DD-HHMMSS/voiceover.mp3`

On Windows, install `ffmpeg` with one of:

```powershell
winget install Gyan.FFmpeg
```

```powershell
choco install ffmpeg
```

Verify that `ffmpeg` is available:

```bash
ffmpeg -version
```

The recommended setup uses OpenAI TTS to create `voiceover.mp3` in the current run folder. If no API key is configured, the CLI falls back to mock voiceover mode: it writes the narration script and instructions, but does not create audio. Without real audio, final narrated MP4 composition is skipped gracefully and notes are written to:

```text
demoOutput-YYYY-MM-DD-HHMMSS/video_composition_notes.md
```

### Recommended full setup

For the best local experience:

```bash
npm install
npx playwright install chromium
ffmpeg -version
```

## Install

```bash
npm install
```

Playwright is listed as an optional dependency. Install Chromium with `npx playwright install chromium` if you want browser screenshots or `.webm` recordings. Install `ffmpeg` separately if you want final MP4 composition.

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

Use full mode when you want browser recording, real voiceover, and MP4 composition attempts.

## Output Files

Generated files are written to a fresh timestamped folder in the target repository. Each run gets a new folder, so previous videos and plans are not overwritten.

Example folder name:

```text
demoOutput-2026-05-10-143012/
```

If a folder with the same timestamp already exists, the CLI appends a suffix such as `-01` to keep the run unique.

Expected contents:

```text
demoOutput-YYYY-MM-DD-HHMMSS/
|-- project_summary.md
|-- demo_plan.draft.json
|-- demo_plan.json
|-- narration_script.md
|-- demo_storyboard.md
|-- manual_recording_guide.md
|-- run_report.json
|-- voiceover_script.txt
|-- voiceover.mp3
|-- demo_video.html
|-- screenshots/
|-- recordings/
`-- demo_video.mp4
```

`demo_plan.json` is written when confidence is high enough. A clear README feature list is enough evidence for a final plan even without `DEMO_GUIDE.md` or `demo.config`.

`demo_video.mp4` is only written when browser recording, real voiceover audio, and `ffmpeg` are available. If MP4 composition is incomplete, `run_report.json` records the status as `partial`, `skipped`, or `failed`, and `demo_video.html` provides a local preview of the browser recording, audio, and screenshots.

## Real Voiceover

For the best result, configure OpenAI TTS in a local `.env` file so the CLI can generate `voiceover.mp3` in the current timestamped run folder. Mock mode is only a fallback for missing API configuration; it keeps the workflow running but does not create real audio.

### Option A: local `.env` file

For day-to-day use, create a local `.env` file in this project root:

```text
D:\GitHub_Repos\repo-demo-video-skill\.env
```

Start from the template:

```powershell
Copy-Item .env.example .env
```

Then edit `.env`:

```env
TTS_PROVIDER=openai
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_TTS_MODEL=gpt-4o-mini-tts
OPENAI_TTS_VOICE=coral
OPENAI_TTS_INSTRUCTIONS=Speak like a polished product demo narrator: clear, warm, concise, and confident.
```

Replace `sk-your-api-key-here` with your real local API key. The CLI loads `.env` automatically through `dotenv/config`, so after creating the local file you can run:

```powershell
npm run demo -- --repo D:\path\to\your-project --mode full
```

### Option B: temporary terminal variables

You can also set variables only for the current PowerShell session:

```powershell
$env:TTS_PROVIDER="openai"
$env:OPENAI_API_KEY="your_api_key"
npm run demo -- --repo D:\path\to\your-project --mode full
```

Optional variables:

```powershell
$env:OPENAI_TTS_MODEL="gpt-4o-mini-tts"
$env:OPENAI_TTS_VOICE="coral"
$env:OPENAI_TTS_INSTRUCTIONS="Speak like a polished product demo narrator."
```

The generated audio is written to:

```text
demoOutput-YYYY-MM-DD-HHMMSS/voiceover.mp3
```

API keys are read only from environment variables or the local `.env` file and are never written into generated artifacts. `.env` and `.env.*` are ignored by git; `.env.example` is intentionally tracked as a safe template. When publishing generated voiceover, disclose that the voice is AI-generated.

If `TTS_PROVIDER` is missing, set to `mock`, or `OPENAI_API_KEY` is not set, the CLI uses mock fallback. In that case it still writes `voiceover_script.txt`, but it does not create `voiceover.mp3`.

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

## README Parsing

The analyzer handles ordinary project READMEs more robustly now:

- skips badges, shield images, decorative rows, raw links, and status metadata
- recognizes decorated headings like `## Features` with emoji or symbols
- extracts feature bullets under feature/capability/highlight headings
- extracts usage workflow steps under usage/how-to/demo/quick-start headings
- prefers clean blockquotes and overview/about/description text for summaries
- sanitizes narration text before writing scripts or TTS input

## Demo Visual Guidance

Browser recordings use temporary Playwright-injected overlays to make the demo easier to follow without modifying the target app source code:

- `#codex-demo-callout`: a bottom caption for the current narration beat
- `#codex-demo-ring`: a yellow highlight ring around the active UI element or result area

These overlays use fixed positioning, high `z-index`, and `pointer-events: none`. They only exist inside the recording browser session and disappear when recording ends.

Overlays must not fabricate functionality. They should only guide viewer attention toward real UI state changes.

## Safety Model

The skill is conservative by design:

- prefers read-only repository analysis
- writes generated artifacts only to a fresh timestamped `demoOutput-YYYY-MM-DD-HHMMSS/` folder
- treats `demo.config` as optional
- avoids destructive commands
- avoids deployment commands
- does not expose secrets, API keys, `.env` values, private tokens, private user data, or credentials
- does not include real passwords in narration or video
- skips local startup when run commands are uncertain
- records partial video deliverables clearly when MP4 composition is unavailable

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
- Playwright browser capture and conservative DOM exploration when a URL is available
- temporary callout and highlight overlays for clearer browser demos
- mock voiceover module
- OpenAI TTS voiceover via environment variables
- graceful `ffmpeg` composition notes and `demo_video.html` fallback

Planned extensions:

- GitHub repo URL cloning
- safer automatic local app startup
- deeper browser interaction
- ElevenLabs or local TTS integration
- captions
- multiple video styles
- automatic feature discovery from UI exploration
- human review UI for `demo_plan.draft.json`
