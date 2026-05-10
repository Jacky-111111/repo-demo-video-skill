import { normalizeWhitespace } from "./fileUtils.js";

const BAD_SUMMARY_PATTERNS = [/!\[/, /shields\.io/i, /badge/i, /coverage/i, /\]\(https?:\/\//i];

export function cleanNarrationText(value: string): string {
  return normalizeWhitespace(
    value
      .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
      .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
      .replace(/https?:\/\/\S+/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/[`*_~>#|]/g, " ")
  );
}

export function isBadNarrationText(value: string): boolean {
  const cleaned = cleanNarrationText(value);
  if (cleaned.length < 20) return true;
  if (BAD_SUMMARY_PATTERNS.some((pattern) => pattern.test(value))) return true;
  const urlCount = value.match(/https?:\/\//g)?.length ?? 0;
  if (urlCount > 1) return true;
  const symbolRatio = cleaned.replace(/[A-Za-z0-9\s.,;:'"()/-]/g, "").length / Math.max(cleaned.length, 1);
  return symbolRatio > 0.18;
}

export function chooseSafeNarrationText(candidates: Array<string | undefined>, fallback: string): string {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const cleaned = cleanNarrationText(candidate);
    if (!isBadNarrationText(cleaned)) {
      return cleaned;
    }
  }
  return fallback;
}
