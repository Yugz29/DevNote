import { useMemo } from "react";
import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";
import HighlightText from "./HighlightText.jsx";
import { useTheme } from "../contexts/ThemeContext.js";
import {
  markdownToBlocks,
  noteExtensions,
  noteSchema,
} from "../lib/blocknote.js";

export default function NoteBlock({
  note,
  searchQuery,
  isCollapsed,
  onToggleCollapse,
  onEdit,
  onDelete,
}) {
  const { theme } = useTheme();

  const initialContent = useMemo(
    () => markdownToBlocks(note.content),
    [note.content],
  );

  const editor = useCreateBlockNote(
    {
      schema: noteSchema,
      extensions: noteExtensions,
      initialContent: initialContent ?? undefined,
    },
    [initialContent],
  );

  return (
    <div className="note-block" data-id={note.id}>
      <div className="note-block-header">
        <div className="note-block-title-row">
          <button
            className="btn-toggle-note"
            title="Toggle content"
            onClick={onToggleCollapse}
          >
            <i
              className={`ph-light ph-caret-down${isCollapsed ? " rotated" : ""}`}
            />
          </button>
          <h3 className="note-block-title">
            <HighlightText text={note.title} query={searchQuery} />
          </h3>
        </div>

        <div className="note-block-actions">
          <button
            className="btn-card-icon-action btn-edit"
            data-id={note.id}
            title="Edit"
            onClick={onEdit}
          >
            <i className="ph-light ph-pencil-simple" />
          </button>
          <button
            className="btn-card-icon-action btn-card-icon-danger btn-delete"
            data-id={note.id}
            title="Delete"
            onClick={onDelete}
          >
            <i className="ph-light ph-trash" />
          </button>
        </div>
      </div>

      <div
        className="note-block-meta"
        style={{ display: isCollapsed ? "none" : undefined }}
      >
        <span className="card-date">
          {new Date(note.created_at).toLocaleDateString()}
        </span>
      </div>

      <div className={`note-block-content${isCollapsed ? " collapsed" : ""}`}>
        {initialContent ? (
          <BlockNoteView
            editor={editor}
            editable={false}
            theme={theme === "light" ? "light" : "dark"}
            className="note-block-view"
          />
        ) : (
          <em>No content</em>
        )}
      </div>
    </div>
  );
}
