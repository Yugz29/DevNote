import HighlightText from "./HighlightText.jsx";

export default function NoteCard({ note, searchQuery, onOpen, onDelete }) {
  const preview = note.preview;

  return (
    <div className="gallery-card gallery-card--note" data-id={note.id}>
      <button
        type="button"
        className="gallery-card-open"
        onClick={() => onOpen(note)}
      >
        <span className="gallery-card-title">
          <HighlightText text={note.title} query={searchQuery} />
        </span>

        {preview ? (
          <span className="gallery-card-preview">
            <HighlightText text={preview} query={searchQuery} />
          </span>
        ) : (
          <span className="gallery-card-preview is-empty">Empty note</span>
        )}

        <span className="gallery-card-meta">
          {new Date(note.updated_at).toLocaleDateString()}
        </span>
      </button>

      <div className="gallery-card-actions">
        <button
          type="button"
          className="btn-card-icon-action btn-card-icon-danger"
          title="Delete"
          onClick={() => onDelete(note)}
        >
          <i className="ph-light ph-trash" />
        </button>
      </div>
    </div>
  );
}
