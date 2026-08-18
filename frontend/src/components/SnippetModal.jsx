import { useState } from "react";
import { createPortal } from "react-dom";
import CodeBlock from "./CodeBlock.jsx";
import CopyButton from "./CopyButton.jsx";
import LanguageIcon from "./LanguageIcon.jsx";
import Modal from "./Modal.jsx";
import SnippetEditor from "./SnippetEditor.jsx";

export default function SnippetModal({
  snippet,
  isEditing,
  onEdit,
  onCancelEdit,
  onSave,
  onDuplicate,
  onTogglePin,
  onExport,
  onDelete,
  onClose,
}) {
  const [isConfirming, setIsConfirming] = useState(false);
  const editTitle = snippet.id ? "Edit snippet" : "New snippet";

  const handleDelete = async () => {
    setIsConfirming(true);

    try {
      await onDelete();
    } finally {
      setIsConfirming(false);
    }
  };

  const handleClose = () => {
    if (isConfirming) return;

    if (isEditing) {
      onCancelEdit();
      return;
    }

    onClose();
  };

  return createPortal(
    <Modal
      isOpen
      title={isEditing ? editTitle : snippet.title}
      onClose={handleClose}
    >
      <div className="snippet-modal">
        {isEditing ? (
          <SnippetEditor
            snippet={snippet}
            onSave={onSave}
            onCancel={onCancelEdit}
          />
        ) : (
          <>
            <div className="snippet-modal-toolbar">
              <div className="snippet-lang-badge">
                <LanguageIcon language={snippet.language} />
                <span className="snippet-lang-name">
                  {snippet.language || "text"}
                </span>
              </div>

              <div className="snippet-modal-actions">
                <CopyButton
                  text={snippet.content}
                  className="btn-card-icon-action"
                />
                <button
                  type="button"
                  className="btn-card-icon-action"
                  title="Edit"
                  onClick={onEdit}
                >
                  <i className="ph-light ph-pencil-simple" />
                </button>
                <button
                  type="button"
                  className="btn-card-icon-action"
                  title="Duplicate"
                  onClick={onDuplicate}
                >
                  <i className="ph-light ph-files" />
                </button>
                {onTogglePin && (
                  <button
                    type="button"
                    className={`btn-card-icon-action${snippet.is_pinned ? " is-active" : ""}`}
                    title={snippet.is_pinned ? "Unpin" : "Pin"}
                    onClick={onTogglePin}
                  >
                    <i
                      className={`ph-light ${snippet.is_pinned ? "ph-push-pin-slash" : "ph-push-pin"}`}
                    />
                  </button>
                )}
                {onExport && (
                  <button
                    type="button"
                    className="btn-card-icon-action"
                    title="Export"
                    onClick={onExport}
                  >
                    <i className="ph-light ph-export" />
                  </button>
                )}
                <button
                  type="button"
                  className="btn-card-icon-action btn-card-icon-danger"
                  title="Delete"
                  onClick={handleDelete}
                >
                  <i className="ph-light ph-trash" />
                </button>
              </div>
            </div>

            {snippet.description && (
              <p className="snippet-modal-description">{snippet.description}</p>
            )}

            <CodeBlock
              code={snippet.content}
              language={snippet.language}
              className="snippet-modal-code"
              showLineNumbers
            />
          </>
        )}
      </div>
    </Modal>,
    document.body,
  );
}
