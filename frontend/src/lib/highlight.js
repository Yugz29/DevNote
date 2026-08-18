import { createHighlighterCore } from "@shikijs/core";
import { createJavaScriptRegexEngine } from "@shikijs/engine-javascript";

const GRAMMARS = {
  bash: {
    id: "shellscript",
    load: () => import("@shikijs/langs-precompiled/shellscript"),
  },
  csharp: {
    id: "csharp",
    load: () => import("@shikijs/langs-precompiled/csharp"),
  },
  css: {
    id: "css",
    load: () => import("@shikijs/langs-precompiled/css"),
  },
  go: {
    id: "go",
    load: () => import("@shikijs/langs-precompiled/go"),
  },
  html: {
    id: "html",
    load: () => import("@shikijs/langs-precompiled/html"),
  },
  java: {
    id: "java",
    load: () => import("@shikijs/langs-precompiled/java"),
  },
  javascript: {
    id: "javascript",
    load: () => import("@shikijs/langs-precompiled/javascript"),
  },
  php: {
    id: "php",
    load: () => import("@shikijs/langs-precompiled/php"),
  },
  python: {
    id: "python",
    load: () => import("@shikijs/langs-precompiled/python"),
  },
  ruby: {
    id: "ruby",
    load: () => import("@shikijs/langs-precompiled/ruby"),
  },
  rust: {
    id: "rust",
    load: () => import("@shikijs/langs-precompiled/rust"),
  },
  sql: {
    id: "sql",
    load: () => import("@shikijs/langs-precompiled/sql"),
  },
  typescript: {
    id: "typescript",
    load: () => import("@shikijs/langs-precompiled/typescript"),
  },
};

let highlighter = null;
const grammarsLoaded = new Map();

function getHighlighter() {
  highlighter ??= createHighlighterCore({
    engine: createJavaScriptRegexEngine(),
    themes: [
      () => import("@shikijs/themes/github-dark"),
      () => import("@shikijs/themes/github-light"),
    ],
    langs: [],
  });

  return highlighter;
}

export async function highlightCode(code, language) {
  const grammar = GRAMMARS[language?.toLowerCase()];
  if (!grammar || !code) return null;

  const shiki = await getHighlighter();

  if (!grammarsLoaded.has(grammar.id)) {
    grammarsLoaded.set(grammar.id, shiki.loadLanguage(grammar.load()));
  }

  await grammarsLoaded.get(grammar.id);

  return shiki.codeToHtml(code, {
    lang: grammar.id,
    themes: { light: "github-light", dark: "github-dark" },
    defaultColor: false,
  });
}
