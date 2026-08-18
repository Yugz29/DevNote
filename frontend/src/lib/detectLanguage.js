import { SNIPPET_LANGUAGES } from "./languages.js";

const MIN_CHARS = 40;
const MIN_POINTS = 4;
const MIN_LEAD = 2;

let detector = null;

export async function detectLanguage(content) {
  const code = content?.trim() ?? "";
  if (code.length < MIN_CHARS) return null;

  detector ??= import("flourite").then((module) => module.default);
  const flourite = await detector;

  const { language, statistics } = flourite(code, {
    shiki: true,
    noUnknown: true,
  });

  if (!SNIPPET_LANGUAGES.includes(language)) return null;

  const points = Object.values(statistics).sort((a, b) => b - a);
  if (!points.length) return language;

  if (points[0] < MIN_POINTS) return null;
  if (points[0] - (points[1] ?? 0) < MIN_LEAD) return null;

  return language;
}
