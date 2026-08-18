import { createExtension } from "@blocknote/core";
import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

const searchHighlightKey = new PluginKey("devnote-search-highlight");

function buildDecorations(doc, query) {
  if (!query) return DecorationSet.empty;

  const needle = query.toLowerCase();
  const decorations = [];

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;

    const haystack = node.text.toLowerCase();
    let index = haystack.indexOf(needle);

    while (index !== -1) {
      decorations.push(
        Decoration.inline(pos + index, pos + index + needle.length, {
          nodeName: "mark",
          class: "search-highlight",
        }),
      );
      index = haystack.indexOf(needle, index + needle.length);
    }
  });

  return DecorationSet.create(doc, decorations);
}

const searchHighlightPlugin = new Plugin({
  key: searchHighlightKey,
  state: {
    init: () => ({ query: "", decorations: DecorationSet.empty }),
    apply(transaction, previous, _oldState, newState) {
      const meta = transaction.getMeta(searchHighlightKey);
      const query = meta ? meta.query : previous.query;

      if (!meta && !transaction.docChanged) return previous;
      if (!meta && !previous.query) return previous;

      return { query, decorations: buildDecorations(newState.doc, query) };
    },
  },
  props: {
    decorations(state) {
      return searchHighlightKey.getState(state)?.decorations;
    },
  },
});

export const searchHighlight = createExtension({
  key: "devnoteSearchHighlight",
  prosemirrorPlugins: [searchHighlightPlugin],
});

export function applySearchHighlight(editor, query) {
  const view = editor?.prosemirrorView;
  if (!view) return false;

  const next = query ?? "";
  const current = searchHighlightKey.getState(view.state)?.query ?? "";
  if (current === next) return true;

  view.dispatch(view.state.tr.setMeta(searchHighlightKey, { query: next }));
  return true;
}
