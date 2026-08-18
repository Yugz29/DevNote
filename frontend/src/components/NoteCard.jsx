import CardMenu from "./CardMenu.jsx";
import HighlightText from "./HighlightText.jsx";

export default function NoteCard({
  note,
  searchQuery,
  onOpen,
  onTogglePin,
  onDuplicate,
  onMove,
  onDelete,
}) {
  const preview = note.preview;

  const menuItems = [
    {
      label: note.is_pinned ? "Unpin" : "Pin",
      icon: note.is_pinned ? "ph-push-pin-slash" : "ph-push-pin",
      onSelect: () => onTogglePin(note),
    },
  ];

  if (onDuplicate) {
    menuItems.push({
      label: "Duplicate",
      icon: "ph-copy",
      onSelect: () => onDuplicate(note),
    });
  }

  if (onMove) {
    menuItems.push({
      label: "Move to…",
      icon: "ph-arrow-elbow-down-right",
      onSelect: () => onMove(note),
    });
  }

  if (onDelete) {
    menuItems.push({
      label: "Delete",
      icon: "ph-trash",
      isDanger: true,
      onSelect: () => onDelete(note),
    });
  }

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
          {note.is_pinned && (
            <i className="ph-light ph-push-pin gallery-card-pin" />
          )}
          {new Date(note.updated_at).toLocaleDateString()}
        </span>
      </button>

      <div className="gallery-card-actions">
        <CardMenu label={`Actions for ${note.title}`} items={menuItems} />
      </div>
    </div>
  );
}
