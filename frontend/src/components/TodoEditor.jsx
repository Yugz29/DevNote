import { useState } from "react";
import DnSelect from "./DnSelect.jsx";
import { PRIORITY_OPTIONS, STATUS_OPTIONS } from "../lib/todos.js";

export default function TodoEditor({ todo, usePortal, onSave, onCancel }) {
  const [title, setTitle] = useState(todo?.title ?? "");
  const [description, setDescription] = useState(todo?.description ?? "");
  const [status, setStatus] = useState(todo?.status || "pending");
  const [priority, setPriority] = useState(todo?.priority || "medium");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (isSaving) return;

    setIsSaving(true);

    try {
      await onSave({ title, description, status, priority });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="todo-card todo-editor" data-id={todo?.id || ""}>
      <div className="todo-card-header">
        <input
          className="todo-editor-title"
          type="text"
          placeholder="Title..."
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />

        <div
          className="item-actions"
          style={{ opacity: 1, visibility: "visible", pointerEvents: "auto" }}
        >
          <button
            className="btn-save-todo btn-card-icon-action"
            title="Save"
            disabled={isSaving}
            onClick={handleSave}
          >
            <i className="ph-light ph-check" />
          </button>
          <button
            className="btn-cancel-todo btn-card-icon-action btn-card-icon-danger"
            title="Cancel"
            onClick={onCancel}
          >
            <i className="ph-light ph-x" />
          </button>
        </div>
      </div>

      <input
        className="todo-editor-description"
        type="text"
        placeholder="Description... (optional)"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
      />

      <div className="todo-editor-footer">
        <DnSelect
          value={status}
          options={STATUS_OPTIONS}
          onChange={setStatus}
          usePortal={usePortal}
        />
        <DnSelect
          value={priority}
          options={PRIORITY_OPTIONS}
          onChange={setPriority}
          usePortal={usePortal}
        />
      </div>
    </div>
  );
}
