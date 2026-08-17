import { useEffect, useRef, useState } from "react";

export default function NoteEditor({ note, onSave, onCancel }) {
  const [title, setTitle] = useState(note?.title ?? "");
  const [content, setContent] = useState(note?.content ?? "");
  const [createdAt] = useState(() => note?.created_at ?? Date.now());
  const textareaRef = useRef(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, []);

  const handleContentChange = (event) => {
    setContent(event.target.value);

    const textarea = event.target;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

  return (
    <div className="note-editor" data-id={note?.id || ""}>
      <div className="note-block-header">
        <input
          className="note-editor-title note-block-title"
          type="text"
          placeholder="Title..."
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
            onClick={() => onSave(title, content)}
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

      <textarea
        className="note-editor-content"
        placeholder="Content... (Markdown supported)"
        ref={textareaRef}
        value={content}
        onChange={handleContentChange}
      />
    </div>
  );
}
