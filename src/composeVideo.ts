import { spawnSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";
import type { VideoCompositionResult } from "./types.js";
import { pathExists, writeText } from "./fileUtils.js";

async function findFirstRecording(recordingsDir: string): Promise<string | undefined> {
  if (!(await pathExists(recordingsDir))) {
    return undefined;
  }

  const files = await readdir(recordingsDir);
  const video = files.find((file) => /\.(webm|mp4|mov)$/i.test(file));
  return video ? path.join(recordingsDir, video) : undefined;
}

async function listImages(screenshotsDir: string): Promise<string[]> {
  if (!(await pathExists(screenshotsDir))) {
    return [];
  }
  const files = await readdir(screenshotsDir);
  return files.filter((file) => /\.(png|jpg|jpeg)$/i.test(file)).map((file) => path.join(screenshotsDir, file));
}

function htmlEscape(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char] ?? char);
}

function probeDuration(file: string): number {
  const result = spawnSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      file
    ],
    { encoding: "utf8" }
  );

  const duration = Number.parseFloat(result.stdout.trim());
  return Number.isFinite(duration) ? duration : 0;
}

async function writePlaybackHtml(outputDir: string, recording?: string, audio?: string): Promise<string> {
  const screenshots = await listImages(path.join(outputDir, "screenshots"));
  const htmlPath = path.join(outputDir, "demo_video.html");
  const relative = (file: string) => path.relative(outputDir, file).split(path.sep).join("/");

  await writeText(
    htmlPath,
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Demo Video Preview</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 32px; color: #1f2937; background: #f8fafc; }
    main { max-width: 1040px; margin: 0 auto; }
    video, audio, img { width: 100%; max-width: 100%; border: 1px solid #d1d5db; background: white; }
    section { margin: 28px 0; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; }
    .note { padding: 12px 14px; background: #fff7ed; border: 1px solid #fed7aa; }
  </style>
</head>
<body>
  <main>
    <h1>Demo Video Preview</h1>
    ${recording ? `<section><h2>Browser Recording</h2><video src="${htmlEscape(relative(recording))}" controls></video></section>` : `<p class="note">No browser recording was found.</p>`}
    ${audio ? `<section><h2>Voiceover Audio</h2><audio src="${htmlEscape(relative(audio))}" controls></audio></section>` : `<p class="note">No real voiceover audio was found.</p>`}
    <section>
      <h2>Screenshots</h2>
      <div class="grid">
        ${screenshots.map((image) => `<img src="${htmlEscape(relative(image))}" alt="${htmlEscape(path.basename(image))}">`).join("\n        ")}
      </div>
    </section>
  </main>
</body>
</html>
`
  );

  return htmlPath;
}

export async function composeVideo(outputDir: string): Promise<VideoCompositionResult> {
  const ffmpeg = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" });
  const warnings: string[] = [];

  if (ffmpeg.status !== 0) {
    warnings.push("ffmpeg was not found on PATH.");
  }

  const recording = await findFirstRecording(path.join(outputDir, "recordings"));
  const audio = (await pathExists(path.join(outputDir, "voiceover.mp3")))
    ? path.join(outputDir, "voiceover.mp3")
    : undefined;
  const playbackHtml = await writePlaybackHtml(outputDir, recording, audio);

  if (!recording) warnings.push("No browser video recording was found.");
  if (!audio) warnings.push("No real voiceover audio file was found at voiceover.mp3. Check voiceover provider settings and warnings in run_report.json.");

  if (warnings.length || !recording || !audio) {
    const status = recording ? "partial" : "skipped";
    await writeText(
      path.join(outputDir, "video_composition_notes.md"),
      `# Video Composition Notes

Final narrated MP4 composition was ${status === "partial" ? "not completed, but a browser recording fallback exists." : "skipped."}

${warnings.map((warning) => `- ${warning}`).join("\n")}

- Browser recording fallback: ${recording ?? "not available"}
- Voiceover audio: ${audio ?? "not available"}
- Local preview page: ${playbackHtml}

Add the missing dependency or artifact, then rerun in full mode to compose demo_video.mp4 in a new demoOutput timestamp folder.
`
    );
    return {
      status,
      success: false,
      deliverables: {
        browserRecordingWebm: recording,
        voiceoverAudio: audio,
        playbackHtml
      },
      warnings
    };
  }

  const finalVideo = path.join(outputDir, "demo_video.mp4");
  const audioDuration = probeDuration(audio);
  const videoDuration = probeDuration(recording);
  const extendedFinalFrameSeconds = Math.max(0, audioDuration - videoDuration);
  const compositionWarnings: string[] = [];
  const args = ["-y", "-i", recording, "-i", audio];

  if (!audioDuration) {
    compositionWarnings.push("Could not read voiceover duration with ffprobe, so ffmpeg will compose without an explicit audio-length target.");
  }
  if (!videoDuration) {
    compositionWarnings.push("Could not read recording duration with ffprobe, so the final frame cannot be extended automatically.");
  }
  if (extendedFinalFrameSeconds > 0.25) {
    args.push("-filter:v", `tpad=stop_mode=clone:stop_duration=${extendedFinalFrameSeconds.toFixed(2)}`);
    compositionWarnings.push(
      `Browser recording was shorter than voiceover, so the final frame was extended for ${extendedFinalFrameSeconds.toFixed(2)} seconds.`
    );
  }

  args.push("-c:v", "libx264", "-c:a", "aac");
  if (audioDuration > 0) {
    args.push("-t", audioDuration.toFixed(2));
  }
  args.push(finalVideo);

  const result = spawnSync("ffmpeg", args, {
    stdio: "ignore"
  });

  if (result.status !== 0) {
    return {
      status: "failed",
      success: false,
      deliverables: {
        browserRecordingWebm: recording,
        voiceoverAudio: audio,
        playbackHtml
      },
      timing: {
        audioDurationSeconds: audioDuration || undefined,
        videoDurationSeconds: videoDuration || undefined,
        extendedFinalFrameSeconds: extendedFinalFrameSeconds > 0.25 ? extendedFinalFrameSeconds : 0
      },
      warnings: ["ffmpeg failed while composing the final video.", ...compositionWarnings]
    };
  }

  return {
    status: "complete",
    success: true,
    artifact: finalVideo,
    deliverables: {
      browserRecordingWebm: recording,
      voiceoverAudio: audio,
      narratedMp4: finalVideo,
      playbackHtml
    },
    timing: {
      audioDurationSeconds: audioDuration || undefined,
      videoDurationSeconds: videoDuration || undefined,
      extendedFinalFrameSeconds: extendedFinalFrameSeconds > 0.25 ? extendedFinalFrameSeconds : 0
    },
    warnings: compositionWarnings
  };
}
