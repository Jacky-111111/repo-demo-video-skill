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

  if (!recording) warnings.push("No browser video recording was found.");
  if (!audio) warnings.push("No real voiceover audio was found; mock mode only wrote the script.");

  if (warnings.length || !recording || !audio) {
    await writeText(
      path.join(outputDir, "video_composition_notes.md"),
      `# Video Composition Notes

Final video composition was skipped.

${warnings.map((warning) => `- ${warning}`).join("\n")}

The written demo artifacts are still usable. Add a browser recording and a real voiceover audio file, then rerun in full mode to compose output/demo_video.mp4.
`
    );
    return { success: false, warnings };
  }

  const finalVideo = path.join(outputDir, "demo_video.mp4");
  const result = spawnSync("ffmpeg", ["-y", "-i", recording, "-i", audio, "-c:v", "libx264", "-c:a", "aac", "-shortest", finalVideo], {
    stdio: "ignore"
  });

  if (result.status !== 0) {
    return {
      success: false,
      warnings: ["ffmpeg failed while composing the final video."]
    };
  }

  return {
    success: true,
    artifact: finalVideo,
    warnings: []
  };
}
