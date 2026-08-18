import { useEffect, useRef, useState } from "react";
import CardMenu from "./CardMenu.jsx";
import HighlightText from "./HighlightText.jsx";

function summarize({ folder_count: folders = 0, note_count: notes = 0 }) {
  const parts = [];

  if (folders) parts.push(`${folders} folder${folders > 1 ? "s" : ""}`);
  if (notes) parts.push(`${notes} note${notes > 1 ? "s" : ""}`);

  return parts.length ? parts.join(" · ") : "Empty";
}

export default function FolderCard({
  folder,
  searchQuery,
  isRenaming,
  onOpen,
  onStartRename,
  onRename,
  onCancelRename,
  onMove,
  onDelete,
}) {
  const inputRef = useRef(null);
  const [draft, setDraft] = useState(folder.name);

  useEffect(() => {
    if (!isRenaming) return;

    inputRef.current?.focus();
    inputRef.current?.select();
  }, [isRenaming]);

  const commit = () => {
    const name = draft.trim();

    if (!name || name === folder.name) {
      onCancelRename();
      return;
    }

    onRename(folder, name);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      onCancelRename();
    }
  };

  if (isRenaming) {
    return (
      <div className="gallery-card gallery-card--folder is-renaming">
        <i className="ph-light ph-folder gallery-card-icon" />
        <input
          ref={inputRef}
          className="gallery-card-input"
          value={draft}
          placeholder="Folder name..."
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commit}
        />
      </div>
    );
  }

  return (
    <div className="gallery-card gallery-card--folder" data-id={folder.id}>
      <button
        type="button"
        className="gallery-card-open"
        onClick={() => onOpen(folder)}
      >
        <i className="ph-light ph-folder gallery-card-icon" />
        <span className="gallery-card-title">
          <HighlightText text={folder.name} query={searchQuery} />
        </span>
        <span className="gallery-card-meta">{summarize(folder)}</span>
      </button>

      <div className="gallery-card-actions">
        <CardMenu
          label={`Actions for ${folder.name}`}
          items={[
            {
              label: "Rename",
              icon: "ph-pencil-simple",
              onSelect: () => onStartRename(folder.id),
            },
            {
              label: "Move to…",
              icon: "ph-arrow-elbow-down-right",
              onSelect: () => onMove(folder),
            },
            {
              label: "Delete",
              icon: "ph-trash",
              isDanger: true,
              onSelect: () => onDelete(folder),
            },
          ]}
        />
      </div>
    </div>
  );
}
