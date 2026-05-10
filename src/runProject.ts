import { spawn } from "node:child_process";
import type { Evidence } from "./types.js";

const UNSAFE_PATTERNS = /(?:rm\s+-|del\s+\/s|rmdir\s+\/s|Remove-Item\s+-Recurse|git\s+clean|deploy|vercel|netlify\s+deploy|firebase\s+deploy)/i;
const SHELL_CONTROL = /[;&|`$<>]/;

export function isSafeRunCommand(command: string): boolean {
  if (UNSAFE_PATTERNS.test(command) || SHELL_CONTROL.test(command)) {
    return false;
  }

  return /^(npm|pnpm|yarn|bun)\s+(run\s+)?(dev|start|preview)$/.test(command.trim());
}

export interface LocalRunAttempt {
  attempted: boolean;
  started: boolean;
  warnings: string[];
  stop?: () => void;
}

export function maybeRunProject(repoPath: string, runCommand?: Evidence<string>): LocalRunAttempt {
  if (!runCommand) {
    return {
      attempted: false,
      started: false,
      warnings: ["No local run command was available."]
    };
  }

  if (runCommand.confidence === "low" || !isSafeRunCommand(runCommand.value)) {
    return {
      attempted: false,
      started: false,
      warnings: [`Skipped local startup because the command was not safe and confident enough: ${runCommand.value}`]
    };
  }

  const [command, ...args] = runCommand.value.split(/\s+/);
  const child = spawn(command, args, {
    cwd: repoPath,
    stdio: "ignore",
    shell: false,
    detached: false
  });

  return {
    attempted: true,
    started: true,
    warnings: [],
    stop: () => child.kill()
  };
}
