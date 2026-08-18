import { useState } from "react";
import { createPortal } from "react-dom";
import DnSelect from "./DnSelect.jsx";
import Modal from "./Modal.jsx";
import TodoEditor from "./TodoEditor.jsx";
import {
  PRIORITY_BADGES,
  PRIORITY_OPTIONS,
  STATUS_BADGES,
  STATUS_OPTIONS,
} from "../lib/todos.js";

export default function TodoModal({
  todo,
  isEditing,
  onEdit,
  onCancelEdit,
  onSave,
  onStatusChange,
  onPriorityChange,
  onDelete,
  onClose,
}) {
  const [isConfirming, setIsConfirming] = useState(false);
  const editTitle = todo.id ? "Edit todo" : "New todo";
  const status = STATUS_BADGES[todo.status] || STATUS_BADGES.pending;
  const priority = PRIORITY_BADGES[todo.priority] || PRIORITY_BADGES.medium;

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
      title={isEditing ? editTitle : todo.title}
      onClose={handleClose}
    >
      <div className="todo-modal">
        {isEditing ? (
          <TodoEditor todo={todo} onSave={onSave} onCancel={onCancelEdit} />
        ) : (
          <>
            <div className="todo-modal-toolbar">
              <div className="todo-modal-badges">
                <DnSelect
                  value={todo.status}
                  options={STATUS_OPTIONS}
                  onChange={onStatusChange}
                  label={`Status: ${status.label}`}
                  triggerClassName={`todo-badge-select badge ${status.class}`}
                />
                <DnSelect
                  value={todo.priority}
                  options={PRIORITY_OPTIONS}
                  onChange={onPriorityChange}
                  label={`Priority: ${priority.label}`}
                  triggerClassName={`todo-badge-select badge ${priority.class}`}
                />
              </div>

              <div className="todo-modal-actions">
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
                  className="btn-card-icon-action btn-card-icon-danger"
                  title="Delete"
                  onClick={handleDelete}
                >
                  <i className="ph-light ph-trash" />
                </button>
              </div>
            </div>

            {todo.description ? (
              <p className="todo-modal-description">{todo.description}</p>
            ) : (
              <p className="todo-modal-description is-empty">No description</p>
            )}

            <div className="todo-modal-meta">
              <span>
                Created {new Date(todo.created_at).toLocaleDateString()}
              </span>
              <span>
                Updated {new Date(todo.updated_at).toLocaleDateString()}
              </span>
            </div>
          </>
        )}
      </div>
    </Modal>,
    document.body,
  );
}
