import { useEffect, useMemo, useRef, useState } from "react";
import { BlockNoteView } from "@blocknote/mantine";
import { combineByGroup, filterSuggestionItems } from "@blocknote/core";
import { getDiagramSlashMenuItems } from "@blocknote/diagram-block";
import {
  SuggestionMenuController,
  getDefaultReactSlashMenuItems,
  useCreateBlockNote,
} from "@blocknote/react";
import { useTheme } from "../contexts/ThemeContext.js";
import {
  markdownToBlocks,
  noteExtensions,
  noteSchema,
} from "../lib/blocknote.js";

export default function NoteEditor({ note, onSave, onCancel }) {
  const { theme } = useTheme();
  const [title, setTitle] = useState(note?.title ?? "");
  const [createdAt] = useState(() => note?.created_at ?? Date.now());
  const [isSaving, setIsSaving] = useState(false);
  const titleRef = useRef(null);
  const isNewNote = !note;

  const initialContent = useMemo(
    () => markdownToBlocks(note?.content),
    [note?.content],
  );

  const editor = useCreateBlockNote(
    {
      schema: noteSchema,
      extensions: noteExtensions,
      initialContent: initialContent ?? undefined,
    },
    [initialContent],
  );

  useEffect(() => {
    if (isNewNote) {
      titleRef.current?.focus();
    } else {
      editor.focus();
    }
  }, [editor, isNewNote]);

  const handleSave = async () => {
    if (isSaving) return;

    setIsSaving(true);

    try {
      await onSave(title, editor.blocksToMarkdownLossy(editor.document).trim());
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="note-editor" data-id={note?.id || ""}>
      <div className="note-block-header">
        <input
          className="note-editor-title note-block-title"
          type="text"
          placeholder="Title..."
          ref={titleRef}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />

        <div
          className="note-block-actions"
          style={{ opacity: 1, visibility: "visible", pointerEvents: "auto" }}
        >
          <button
            className="btn-card-icon-action btn-save-note"
            title="Save"
            disabled={isSaving}
            onClick={handleSave}
          >
            <i className="ph-light ph-check" />
          </button>
          <button
            className="btn-card-icon-action btn-card-icon-danger btn-cancel-note"
            title="Cancel"
            onClick={onCancel}
          >
            <i className="ph-light ph-x" />
          </button>
        </div>
      </div>

      <div className="note-block-meta">
        <span className="card-date">
          {new Date(createdAt).toLocaleDateString()}
        </span>
      </div>

      <BlockNoteView
        editor={editor}
        theme={theme === "light" ? "light" : "dark"}
        className="note-editor-view"
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
  );
}
