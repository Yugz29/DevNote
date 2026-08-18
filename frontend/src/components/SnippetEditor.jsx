import { useEffect, useRef, useState } from "react";
import DnSelect from "./DnSelect.jsx";
import { detectLanguage } from "../lib/detectLanguage.js";
import { SNIPPET_LANGUAGE_OPTIONS } from "../lib/languages.js";

const DETECT_DELAY = 500;

export default function SnippetEditor({ snippet, onSave, onCancel }) {
  const [title, setTitle] = useState(snippet?.title ?? "");
  const [description, setDescription] = useState(snippet?.description ?? "");
  const [content, setContent] = useState(snippet?.content ?? "");
  const [language, setLanguage] = useState(snippet?.language || "text");
  const [isSaving, setIsSaving] = useState(false);
  const [suggestion, setSuggestion] = useState(null);

  const textareaRef = useRef(null);

  const handleSave = async () => {
    if (isSaving) return;

    setIsSaving(true);

    try {
      await onSave({ title, language, content, description });
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, []);

  useEffect(() => {
    let isStale = false;

    const store = (detected) => {
      if (!isStale) setSuggestion(detected);
    };

    const timer = setTimeout(() => {
      detectLanguage(content).then(store, () => store(null));
    }, DETECT_DELAY);

    return () => {
      isStale = true;
      clearTimeout(timer);
    };
  }, [content]);

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
          <DnSelect
            value={language}
            options={SNIPPET_LANGUAGE_OPTIONS}
            onChange={(value) => {
              setLanguage(value);
              setSuggestion(null);
            }}
          />

          {suggestion && suggestion !== language && (
            <button
              type="button"
              className="snippet-lang-suggestion"
              title={`Set the language to ${suggestion}`}
              onClick={() => {
                setLanguage(suggestion);
                setSuggestion(null);
              }}
            >
              <i className="ph-light ph-magic-wand" />
              <span>Looks like {suggestion}?</span>
            </button>
          )}
        </div>

        <div
          className="item-actions"
          style={{ opacity: 1, visibility: "visible", pointerEvents: "auto" }}
        >
          <button
            className="btn-save-snippet btn-card-icon-action"
            title="Save"
            disabled={isSaving}
            onClick={handleSave}
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
