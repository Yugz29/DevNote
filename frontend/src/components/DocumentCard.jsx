import CardMenu from "./CardMenu.jsx";
import HighlightText from "./HighlightText.jsx";

export default function DocumentCard({
  doc,
  searchQuery,
  onOpen,
  onTogglePin,
  onDuplicate,
  onExportMarkdown,
  onExportPdf,
  onMove,
  onDelete,
}) {
  const preview = doc.preview;

  const menuItems = [
    {
      label: doc.is_pinned ? "Unpin" : "Pin",
      icon: doc.is_pinned ? "ph-push-pin-slash" : "ph-push-pin",
      onSelect: () => onTogglePin(doc),
    },
  ];

  if (onDuplicate) {
    menuItems.push({
      label: "Duplicate",
      icon: "ph-copy",
      onSelect: () => onDuplicate(doc),
    });
  }

  const exportItems = [];

  if (onExportMarkdown) {
    exportItems.push({
      label: "Markdown",
      icon: "ph-file-md",
      onSelect: () => onExportMarkdown(doc),
    });
  }

  if (onExportPdf) {
    exportItems.push({
      label: "PDF",
      icon: "ph-file-pdf",
      onSelect: () => onExportPdf(doc),
    });
  }

  if (exportItems.length > 0) {
    menuItems.push({
      label: "Export",
      icon: "ph-export",
      items: exportItems,
    });
  }

  if (onMove) {
    menuItems.push({
      label: "Move to…",
      icon: "ph-arrow-elbow-down-right",
      onSelect: () => onMove(doc),
    });
  }

  if (onDelete) {
    menuItems.push({
      label: "Delete",
      icon: "ph-trash",
      isDanger: true,
      onSelect: () => onDelete(doc),
    });
  }

  return (
    <div className="gallery-card gallery-card--document" data-id={doc.id}>
      <button
        type="button"
        className="gallery-card-open"
        onClick={() => onOpen(doc)}
      >
        <span className="gallery-card-title">
          <HighlightText text={doc.title} query={searchQuery} />
        </span>

        {preview ? (
          <span className="gallery-card-preview">
            <HighlightText text={preview} query={searchQuery} />
          </span>
        ) : (
          <span className="gallery-card-preview is-empty">Empty document</span>
        )}

        <span className="gallery-card-meta">
          {doc.is_pinned && (
            <i className="ph-light ph-push-pin gallery-card-pin" />
          )}
          {new Date(doc.updated_at).toLocaleDateString()}
        </span>
      </button>

      <div className="gallery-card-actions">
        <CardMenu label={`Actions for ${doc.title}`} items={menuItems} />
      </div>
    </div>
  );
}
