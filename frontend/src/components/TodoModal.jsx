import { useState } from "react";
import { createPortal } from "react-dom";
import CardMenu from "./CardMenu.jsx";
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
  onMove,
  onTogglePin,
  onReveal,
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
              <div className="todo-modal-badges" data-priority={todo.priority}>
                <DnSelect
                  value={todo.priority}
                  options={PRIORITY_OPTIONS}
                  onChange={onPriorityChange}
                  label={`Priority: ${priority.label}`}
                  triggerClassName="todo-meta-priority"
                />

                <DnSelect
                  value={todo.status}
                  options={STATUS_OPTIONS}
                  onChange={onStatusChange}
                  label={`Status: ${status.label}`}
                  triggerClassName="todo-meta-status"
                />
              </div>

              <div className="todo-modal-actions">
                <CardMenu
                  label={`Actions for ${todo.title}`}
                  items={[
                    {
                      label: "Edit",
                      icon: "ph-pencil-simple",
                      onSelect: onEdit,
                    },
                    ...(onMove
                      ? [
                          {
                            label: "Move to…",
                            icon: "ph-arrow-elbow-down-right",
                            onSelect: onMove,
                          },
                        ]
                      : []),
                    ...(onTogglePin
                      ? [
                          {
                            label: todo.is_pinned ? "Unpin" : "Pin",
                            icon: todo.is_pinned
                              ? "ph-push-pin-slash"
                              : "ph-push-pin",
                            onSelect: onTogglePin,
                          },
                        ]
                      : []),
                    ...(onReveal
                      ? [
                          {
                            label: "Go to location",
                            icon: "ph-arrow-square-out",
                            onSelect: onReveal,
                          },
                        ]
                      : []),
                    {
                      label: "Delete",
                      icon: "ph-trash",
                      isDanger: true,
                      onSelect: handleDelete,
                    },
                  ]}
                />
              </div>
            </div>

            {todo.description ? (
              <p className="todo-modal-description">{todo.description}</p>
            ) : (
              <p className="todo-modal-description is-empty">No description</p>
            )}

            <div className="todo-modal-meta">
              {todo.due_date && (
                <span>Due {new Date(todo.due_date).toLocaleDateString()}</span>
              )}
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
