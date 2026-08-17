import { codeBlockOptions, syntaxHighlighter } from "@blocknote/code-block";
import {
  BlockNoteEditor,
  BlockNoteSchema,
  createCodeBlockSpec,
} from "@blocknote/core";
import {
  createReactDiagramBlockSpec,
  initializeMermaid,
} from "@blocknote/diagram-block";
import mermaid from "mermaid";
import { searchHighlight } from "./searchHighlight.js";

const FALLBACK_LANGUAGE = "text";

initializeMermaid();

let mermaidTheme = null;

export function applyMermaidTheme(theme) {
  const isLight = theme === "light";
  if (mermaidTheme === isLight) return;

  mermaidTheme = isLight;
  mermaid.initialize({
    startOnLoad: false,
    suppressErrorRendering: true,
    theme: isLight ? "default" : "dark",
    darkMode: !isLight,
  });
}

applyMermaidTheme("dark");

export const noteSchema = BlockNoteSchema.create().extend({
  blockSpecs: {
    codeBlock: createCodeBlockSpec({
      ...codeBlockOptions,
      defaultLanguage: FALLBACK_LANGUAGE,
    }),
    diagram: createReactDiagramBlockSpec(),
  },
});

export const noteExtensions = [syntaxHighlighter, searchHighlight];

const languageIds = new Map();

for (const [id, { aliases }] of Object.entries(
  codeBlockOptions.supportedLanguages,
)) {
  languageIds.set(id.toLowerCase(), id);

  for (const alias of aliases ?? []) {
    languageIds.set(alias.toLowerCase(), id);
  }
}

function normalizeCodeLanguages(blocks) {
  for (const block of blocks) {
    if (block.type === "codeBlock") {
      const language = block.props?.language?.trim().toLowerCase();
      block.props.language = languageIds.get(language) ?? FALLBACK_LANGUAGE;
    }

    if (block.children?.length) {
      normalizeCodeLanguages(block.children);
    }
  }

  return blocks;
}

let parser = null;

export function markdownToBlocks(markdown) {
  if (!markdown?.trim()) return null;

  parser ??= BlockNoteEditor.create({
    schema: noteSchema,
    extensions: noteExtensions,
  });

  const blocks = normalizeCodeLanguages(
    parser.tryParseMarkdownToBlocks(markdown),
  );
  return blocks.length ? blocks : null;
}
