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

const FALLBACK_LANGUAGE = "text";

initializeMermaid();
mermaid.initialize({
  startOnLoad: false,
  suppressErrorRendering: true,
  theme: "dark",
  darkMode: true,
});

export const noteSchema = BlockNoteSchema.create().extend({
  blockSpecs: {
    codeBlock: createCodeBlockSpec({
      ...codeBlockOptions,
      defaultLanguage: FALLBACK_LANGUAGE,
    }),
    diagram: createReactDiagramBlockSpec(),
  },
});

export const noteExtensions = [syntaxHighlighter];

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
