---
name: repo-demo-video
description: Generate a narrated product demo video workflow from a GitHub repository or local project. Use when Codex needs to analyze README.md, DEMO_GUIDE.md, demo.config files, package metadata, routes, components, and optionally a deployed URL to produce a demo plan, narration script, manual recording guide, browser screenshots or recordings, optional OpenAI TTS voiceover, partial video fallbacks, and final video composition notes.
---

# Repo Demo Video

Use this skill to turn a repository into a polished product demo plan and, when enough runtime information is available, a browser-recorded demo video.

## Core Principle

Prefer repository evidence over user-perfect configuration:

1. Use `demo.config.json` or `demo.config.yaml` when present.
2. Use `DEMO_GUIDE.md` when present.
3. Use `README.md`.
4. Use `package.json`, framework files, route folders, component names, page titles, and source structure.
5. Explore a deployed or local app in the browser when a safe URL exists.
6. Generate fallback assumptions with confidence scores.

Treat `README.md` plus source code as the primary source, `DEMO_GUIDE.md` as the recommended human-friendly guide, and `demo.config.*` as an optional machine-friendly override.

## Workflow

1. Resolve the target repository path or URL. For the MVP CLI, use a local repository path; if given a GitHub URL, ask the user to provide a local clone unless a future cloning workflow is explicitly available.
2. Run the analyzer:

   ```bash
   npm run demo -- --repo ./path-to-repo
   ```

   Optional inputs:

   ```bash
   npm run demo -- --repo ./path-to-repo --config ./demo.config.json
   npm run demo -- --repo ./path-to-repo --url https://example.com
   npm run demo -- --repo ./path-to-repo --mode draft
   npm run demo -- --repo ./path-to-repo --mode full
   ```

3. Review generated artifacts in a timestamped output folder such as `demoOutput-2026-05-10-143012/`:
   - `project_summary.md`
   - `demo_plan.draft.json`
- `demo_plan.json` when confidence is high enough
   - `narration_script.md`
   - `demo_storyboard.md`
   - `manual_recording_guide.md`
   - `recordings/` when browser capture succeeds
   - `screenshots/` when browser exploration succeeds
   - `voiceover.mp3` when `TTS_PROVIDER=openai` and `OPENAI_API_KEY` are available
   - `demo_video.html` as a local preview fallback when MP4 composition is incomplete
   - `demo_video.mp4` only when recording, real audio, and `ffmpeg` are available

## Confidence Rules

- Mark explicit documentation and config claims as `high`.
- Treat README feature lists as enough evidence to generate a final plan when the project name, summary, and at least one feature are clear.
- Mark route names, component names, package metadata, and clear code structure as `medium`.
- Mark speculative product claims and guessed actions as `low`.
- If important claims are low confidence, generate `demo_plan.draft.json`, explain what is missing, and avoid presenting the final video plan as certain.

## README Parsing

- Ignore badges, shield images, decorative image rows, raw URLs, and license/status metadata when extracting product summaries.
- Prefer `DEMO_GUIDE.md` pitch, README blockquote summary, README overview/about/description sections, then package description.
- Recognize decorated headings such as `## Features` with emoji or symbols by normalizing headings before matching.
- Extract bullet lists under feature/capability/highlight headings as high-confidence features.
- Extract numbered workflows under usage/how-to/demo/quick-start headings as medium-confidence demo flow hints.
- Sanitize narration inputs before writing scripts; do not carry Markdown badges, image syntax, or raw URLs into voiceover text.

## Safety

- Keep repository analysis read-only.
- Write generated artifacts only into a new timestamped `demoOutput-YYYY-MM-DD-HHMMSS/` folder in the target repository.
- Do not delete files recursively or run destructive commands.
- Do not run deployment commands.
- Do not expose secrets, API keys, private tokens, `.env` values, private user data, or real credentials in narration, screenshots, or video.
- If a test account is documented, mention only that a demo account is used unless the user explicitly asks otherwise.

## Browser And Video Behavior

- Prefer a deployed `demoUrl` from config, `DEMO_GUIDE.md`, README, or the `--url` argument.
- Use Playwright when available to inspect visible headings, buttons, links, forms, and capture screenshots or recordings.
- Use conservative DOM heuristics to fill safe sample inputs, choose non-empty select options, and click common demo controls such as Add, Calculate, Method, Resources, New, or Create.
- Register the canonical `.webm` recording path in `run_report.json`.
- Do not force local project startup when run instructions are uncertain.
- If Playwright, TTS, `ffmpeg`, or the app runtime is unavailable, still produce the written artifacts, partial deliverables, `demo_video.html`, and a manual recording guide.

## Voiceover

- Default to mock TTS mode with no API key.
- To generate real audio, set `TTS_PROVIDER=openai` and `OPENAI_API_KEY`.
- Optional variables: `OPENAI_TTS_MODEL`, `OPENAI_TTS_VOICE`, `OPENAI_TTS_INSTRUCTIONS`, `TTS_VOICE`.
- Write real audio to the current run folder, for example `demoOutput-2026-05-10-143012/voiceover.mp3`.
- Never write API keys into generated files.
- Disclose that generated voiceover is AI-generated when publishing the demo.

## Extending The Skill

Keep the architecture modular. Add future support for GitHub URL cloning, deeper UI interaction, real TTS providers, captions, video styles, local startup, and human review by extending the corresponding `src/*.ts` module instead of turning the CLI into one large script.
