import { renderMarkdown } from "../lib/markdown.js";

export default function NoteBlock({
  note,
  isCollapsed,
  onToggleCollapse,
  onEdit,
  onDelete,
}) {
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
          <h3 className="note-block-title">{note.title}</h3>
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

      {note.content ? (
        <div
          className={`note-block-content markdown${isCollapsed ? " collapsed" : ""}`}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(note.content) }}
        />
      ) : (
        <div
          className={`note-block-content markdown${isCollapsed ? " collapsed" : ""}`}
        >
          <em>No content</em>
        </div>
      )}
    </div>
  );
}
