import path from "node:path";
import type { ComponentHint, InferredRoute } from "./types.js";
import { titleFromSlug, toPosixPath, uniqueBy } from "./fileUtils.js";

const ROUTE_ROOTS = ["pages", "app", "src/pages", "src/routes"];
const PAGE_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".svelte", ".vue", ".astro"]);
const IGNORED_SEGMENTS = new Set(["api", "_app", "_document", "_error", "layout", "loading", "error", "not-found", "template"]);

function routeFromFile(repoPath: string, file: string): string | undefined {
  const relative = toPosixPath(path.relative(repoPath, file));
  const root = ROUTE_ROOTS.find((candidate) => relative === candidate || relative.startsWith(`${candidate}/`));
  if (!root || !PAGE_EXTENSIONS.has(path.extname(file))) {
    return undefined;
  }

  const withoutRoot = relative.slice(root.length).replace(/^\//, "");
  const withoutExt = withoutRoot.replace(/\.[^.]+$/, "");
  const parts = withoutExt.split("/").filter(Boolean);

  if (root === "app" || root === "src/routes") {
    const last = parts.at(-1);
    if (last && ["page", "+page"].includes(last)) {
      parts.pop();
    }
  }

  const routeParts = parts
    .filter((segment) => !IGNORED_SEGMENTS.has(segment))
    .filter((segment) => !segment.startsWith("(") || !segment.endsWith(")"))
    .map((segment) => {
      if (segment === "index" || segment === "+page") return "";
      if (segment.startsWith("[") && segment.endsWith("]")) return `:${segment.slice(1, -1)}`;
      return segment;
    })
    .filter(Boolean);

  return `/${routeParts.join("/")}`;
}

export function inferRoutes(repoPath: string, sourceFiles: string[]): InferredRoute[] {
  const routes = sourceFiles
      .map<InferredRoute | undefined>((file) => {
        const route = routeFromFile(repoPath, file);
        return route
          ? {
              route,
              sourceFile: file,
              confidence: "medium"
            }
          : undefined;
      })
      .filter((item): item is InferredRoute => Boolean(item));

  return uniqueBy(
    routes,
    (item) => item.route
  ).slice(0, 20);
}

export function inferComponents(repoPath: string, sourceFiles: string[]): ComponentHint[] {
  const componentFiles = sourceFiles.filter((file) => {
    const relative = toPosixPath(path.relative(repoPath, file));
    return /(^|\/)components?\//i.test(relative) && PAGE_EXTENSIONS.has(path.extname(file));
  });

  return uniqueBy(
    componentFiles.map((file) => ({
      name: titleFromSlug(path.basename(file)),
      sourceFile: file,
      confidence: "medium" as const
    })),
    (item) => item.name
  ).slice(0, 30);
}
