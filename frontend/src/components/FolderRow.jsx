import { useEffect, useRef, useState } from "react";
import HighlightText from "./HighlightText.jsx";

export default function FolderRow({
  folder,
  searchQuery,
  isRenaming,
  onOpen,
  onStartRename,
  onRename,
  onCancelRename,
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

  return (
    <div className="folder-row" data-id={folder.id}>
      <button
        type="button"
        className="folder-row-main"
        onClick={() => !isRenaming && onOpen(folder)}
        disabled={isRenaming}
      >
        <i className="ph-light ph-folder folder-row-icon" />
        {isRenaming ? (
          <input
            ref={inputRef}
            className="folder-row-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={commit}
            onClick={(event) => event.stopPropagation()}
          />
        ) : (
          <span className="folder-row-name">
            <HighlightText text={folder.name} query={searchQuery} />
          </span>
        )}
      </button>

      {!isRenaming && (
        <div className="folder-row-actions">
          <button
            type="button"
            className="btn-card-icon-action"
            title="Rename"
            onClick={() => onStartRename(folder.id)}
          >
            <i className="ph-light ph-pencil-simple" />
          </button>
          <button
            type="button"
            className="btn-card-icon-action btn-card-icon-danger"
            title="Delete"
            onClick={() => onDelete(folder)}
          >
            <i className="ph-light ph-trash" />
          </button>
        </div>
      )}
    </div>
  );
}
