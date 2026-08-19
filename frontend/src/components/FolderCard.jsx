import { useEffect, useRef, useState } from "react";
import CardMenu from "./CardMenu.jsx";
import HighlightText from "./HighlightText.jsx";

function summarize({ folder_count: folders = 0, document_count: docs = 0 }) {
  const total = folders + docs;

  if (!total) return "Empty";

  return `${total} item${total > 1 ? "s" : ""}`;
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
      <div className="entry-tile entry-tile--folder">
        <div className="entry-tile-open">
          <i className="ph-light ph-folder entry-tile-icon" />
          <input
            ref={inputRef}
            className="entry-tile-input"
            value={draft}
            placeholder="Folder name..."
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={commit}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="entry-tile entry-tile--folder" data-id={folder.id}>
      <button
        type="button"
        className="entry-tile-open"
        title={folder.name}
        onClick={() => onOpen(folder)}
      >
        <i className="ph-light ph-folder entry-tile-icon" />
        <span className="entry-tile-name">
          <HighlightText text={folder.name} query={searchQuery} />
        </span>
        <span className="entry-tile-meta">{summarize(folder)}</span>
      </button>

      <div className="entry-tile-actions">
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
