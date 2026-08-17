import { useEffect, useImperativeHandle, useRef, useState } from "react";
import { BlockNoteView } from "@blocknote/mantine";
import { combineByGroup, filterSuggestionItems } from "@blocknote/core";
import { getDiagramSlashMenuItems } from "@blocknote/diagram-block";
import {
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
  useCreateBlockNote,
} from "@blocknote/react";
import HighlightText from "./HighlightText.jsx";
import { useTheme } from "../contexts/ThemeContext.js";
import {
  markdownToBlocks,
  noteExtensions,
  noteSchema,
} from "../lib/blocknote.js";
import { applySearchHighlight } from "../lib/searchHighlight.js";

const EMPTY_DOCUMENT = [{ type: "paragraph" }];

export default function NoteBlock({
  note,
  searchQuery,
  onSave,
  onDiscard,
  onDelete,
  ref,
}) {
  const isNewNote = !note;
  const { theme } = useTheme();
  const blockRef = useRef(null);
  const titleRef = useRef(null);
  const baselineRef = useRef(null);
  const isSavingRef = useRef(false);
  const skipCommitRef = useRef(false);
  const hasAutoFocused = useRef(false);
  const [isEditing, setIsEditing] = useState(isNewNote);
  const [createdAt] = useState(() => note?.created_at ?? Date.now());

  const [initialContent] = useState(() => markdownToBlocks(note?.content));

  const editor = useCreateBlockNote(
    {
      schema: noteSchema,
      extensions: noteExtensions,
      initialContent: initialContent ?? undefined,
    },
    [],
  );

  const readTitle = () => titleRef.current?.textContent.trim() ?? "";

  const readContent = () =>
    editor.blocksToMarkdownLossy(editor.document).trim();

  const restore = () => {
    editor.replaceBlocks(
      editor.document,
      markdownToBlocks(note.content) ?? EMPTY_DOCUMENT,
    );

    if (titleRef.current) {
      titleRef.current.contentEditable = "false";
      titleRef.current.textContent = note.title;
    }
  };

  const commit = async () => {
    if (isSavingRef.current) return;

    const title = readTitle();
    const content = readContent();
    const baseline = baselineRef.current;

    setIsEditing(false);

    if (isNewNote && !title && !content) {
      baselineRef.current = null;
      onDiscard();
      return;
    }

    if (baseline && baseline.title === title && baseline.content === content) {
      baselineRef.current = null;
      return;
    }

    isSavingRef.current = true;

    try {
      const saved = await onSave(note?.id ?? null, title, content);

      if (saved) {
        baselineRef.current = null;
        if (isNewNote) onDiscard();
      }
    } finally {
      isSavingRef.current = false;
    }
  };

  useImperativeHandle(ref, () => ({
    flush: () => (baselineRef.current ? commit() : Promise.resolve()),
  }));

  const handleFocusIn = () => {
    skipCommitRef.current = false;

    if (!baselineRef.current) {
      baselineRef.current = { title: readTitle(), content: readContent() };
    }
  };

  const handleFocusOut = () => {
    window.setTimeout(() => {
      if (!blockRef.current) return;

      if (skipCommitRef.current) {
        skipCommitRef.current = false;
        return;
      }

      const active = document.activeElement;

      if (
        active &&
        (blockRef.current.contains(active) || editor.isWithinEditor(active))
      ) {
        return;
      }

      commit();
    }, 0);
  };

  const cancelEditing = () => {
    skipCommitRef.current = true;
    baselineRef.current = null;
    setIsEditing(false);

    if (isNewNote) {
      onDiscard();
      return;
    }

    restore();
    editor.prosemirrorView?.dom.blur();
  };

  const handleKeyDown = (event) => {
    if (event.key !== "Escape" || !isEditing) return;

    event.preventDefault();
    cancelEditing();
  };

  const placeCaretAt = (coords) => {
    const view = editor.prosemirrorView;
    if (!view) return;

    view.focus();

    const target = view.posAtCoords(coords);
    if (!target) return;

    try {
      const { state } = view;
      const selection = state.selection.constructor.near(
        state.doc.resolve(target.pos),
      );
      view.dispatch(state.tr.setSelection(selection));
    } catch {
      editor.focus();
    }
  };

  const handleContentMouseDown = (event) => {
    if (isEditing) return;

    const coords = { left: event.clientX, top: event.clientY };

    setIsEditing(true);
    requestAnimationFrame(() => placeCaretAt(coords));
  };

  const startTitleEdit = () => {
    const element = titleRef.current;
    if (!element || element.contentEditable === "true") return;

    const original = element.textContent;
    element.contentEditable = "true";
    element.focus();

    const range = document.createRange();
    const selection = window.getSelection();
    range.selectNodeContents(element);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);

    const finish = () => {
      element.removeEventListener("keydown", onKeyDown);
      element.contentEditable = "false";

      if (!element.textContent.trim()) {
        element.textContent = original;
      }
    };

    function onKeyDown(event) {
      if (event.key === "Enter") {
        event.preventDefault();
        element.blur();
        return;
      }

      if (event.key === "Escape") {
        element.removeEventListener("blur", finish);
        element.removeEventListener("keydown", onKeyDown);
        element.contentEditable = "false";
        element.textContent = original;
      }
    }

    element.addEventListener("blur", finish, { once: true });
    element.addEventListener("keydown", onKeyDown);
  };

  useEffect(() => {
    if (!isNewNote || hasAutoFocused.current) return;

    hasAutoFocused.current = true;
    startTitleEdit();
  });

  useEffect(() => {
    if (applySearchHighlight(editor, searchQuery)) return;

    const frame = requestAnimationFrame(() =>
      applySearchHighlight(editor, searchQuery),
    );

    return () => cancelAnimationFrame(frame);
  }, [editor, searchQuery]);

  return (
    <div
      className="note-block"
      data-id={note?.id ?? ""}
      ref={blockRef}
      onFocus={handleFocusIn}
      onBlur={handleFocusOut}
      onKeyDown={handleKeyDown}
    >
      <div className={`note-block-header${isEditing ? " editing" : ""}`}>
        <div className="note-block-title-row">
          <h3
            className="note-block-title"
            ref={titleRef}
            data-placeholder="Title..."
            onClick={startTitleEdit}
          >
            <HighlightText text={note?.title ?? ""} query={searchQuery} />
          </h3>
        </div>

        <div className="note-block-actions">
          {!isNewNote && (
            <button
              className="btn-card-icon-action btn-card-icon-danger btn-delete"
              data-id={note.id}
              title="Delete"
              onClick={onDelete}
            >
              <i className="ph-light ph-trash" />
            </button>
          )}
        </div>
      </div>

      <div className="note-block-meta">
        <span className="card-date">
          {new Date(createdAt).toLocaleDateString()}
        </span>
      </div>

      <div className="note-block-content" onMouseDown={handleContentMouseDown}>
        <BlockNoteView
          key={theme}
          editor={editor}
          editable={isEditing}
          theme={theme === "light" ? "light" : "dark"}
          className={`note-block-view${isEditing ? " editing" : ""}`}
          slashMenu={false}
        >
          <SuggestionMenuController
            triggerCharacter="/"
            getItems={async (query) =>
              filterSuggestionItems(
                combineByGroup(
                  getDefaultReactSlashMenuItems(editor),
                  getDiagramSlashMenuItems(editor),
                ),
                query,
              )
            }
          />
        </BlockNoteView>
      </div>
    </div>
  );
}
