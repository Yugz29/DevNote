import { useCallback, useEffect, useRef, useState } from "react";
import { useClickOutside } from "../hooks/useClickOutside.js";
import { SNIPPET_LANGUAGES } from "../lib/languages.js";

export default function SnippetEditor({ snippet, onSave, onCancel }) {
  const [title, setTitle] = useState(snippet?.title ?? "");
  const [description, setDescription] = useState(snippet?.description ?? "");
  const [content, setContent] = useState(snippet?.content ?? "");
  const [language, setLanguage] = useState(snippet?.language || "text");
  const [isSelectOpen, setIsSelectOpen] = useState(false);

  const selectRef = useRef(null);
  const textareaRef = useRef(null);

  const closeSelect = useCallback(() => setIsSelectOpen(false), []);
  useClickOutside(selectRef, closeSelect, isSelectOpen);

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
    <div className="snippet-card snippet-editor" data-id={snippet?.id || ""}>
      <div className="snippet-card-header">
        <div className="snippet-lang-badge">
          <div className="dn-select-wrap" ref={selectRef}>
            <button
              className="dn-select-btn"
              type="button"
              onClick={() => setIsSelectOpen((current) => !current)}
            >
              <span className="dn-select-value">{language}</span>
              <i
                className="ph-light ph-caret-down dn-select-chevron"
                style={{ transform: isSelectOpen ? "rotate(180deg)" : "" }}
              />
            </button>

            <div className={`dn-select-dropdown${isSelectOpen ? " open" : ""}`}>
              {SNIPPET_LANGUAGES.map((option) => (
                <button
                  key={option}
                  className={`dn-select-option ${option === language ? "active" : ""}`}
                  data-value={option}
                  type="button"
                  onClick={() => {
                    setLanguage(option);
                    setIsSelectOpen(false);
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div
          className="item-actions"
          style={{ opacity: 1, visibility: "visible", pointerEvents: "auto" }}
        >
          <button
            className="btn-save-snippet btn-card-icon-action"
            title="Save"
            onClick={() => onSave({ title, language, content, description })}
          >
            <i className="ph-light ph-check" />
          </button>
          <button
            className="btn-cancel-snippet btn-card-icon-action btn-card-icon-danger"
            title="Cancel"
            onClick={onCancel}
          >
            <i className="ph-light ph-x" />
          </button>
        </div>
      </div>

      <input
        className="snippet-editor-title"
        type="text"
        placeholder="Title..."
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />

      <input
        className="snippet-editor-description"
        type="text"
        placeholder="Description... (optional)"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
      />

      <textarea
        className="snippet-editor-content"
        placeholder="Code..."
        ref={textareaRef}
        value={content}
        onChange={handleContentChange}
      />
    </div>
  );
}
