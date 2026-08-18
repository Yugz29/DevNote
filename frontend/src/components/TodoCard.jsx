import DnSelect from "./DnSelect.jsx";
import HighlightText from "./HighlightText.jsx";
import {
  PRIORITY_BADGES,
  STATUS_BADGES,
  STATUS_OPTIONS,
} from "../lib/todos.js";

export default function TodoCard({
  todo,
  searchQuery,
  usePortal,
  onStatusChange,
  onEdit,
  onDelete,
}) {
  const priority = PRIORITY_BADGES[todo.priority] || PRIORITY_BADGES.medium;
  const status = STATUS_BADGES[todo.status] || STATUS_BADGES.pending;

  return (
    <div
      className={`todo-card ${todo.status === "done" ? "is-done" : ""}`}
      data-id={todo.id}
    >
      <div className="todo-card-header">
        <DnSelect
          value={todo.status}
          options={STATUS_OPTIONS}
          onChange={onStatusChange}
          usePortal={usePortal}
          label={`Status: ${status.label}`}
          triggerClassName={`todo-status-btn badge ${status.class}`}
        />

        <span className="todo-title">
          <HighlightText text={todo.title} query={searchQuery} />
        </span>

        <div className="item-actions">
          <button
            className="edit-todo-btn btn-card-icon-action"
            data-id={todo.id}
            title="Edit"
            onClick={onEdit}
          >
            <i className="ph-light ph-pencil-simple" />
          </button>
          <button
            className="delete-todo-btn btn-card-icon-action btn-card-icon-danger"
            data-id={todo.id}
            title="Delete"
            onClick={onDelete}
          >
            <i className="ph-light ph-trash" />
          </button>
        </div>
      </div>

      {todo.description && (
        <p className="todo-description">
          <HighlightText text={todo.description} query={searchQuery} />
        </p>
      )}

      <div className="todo-card-footer">
        <span className={`badge ${priority.class}`}>{priority.label}</span>
        <span className="card-date">
          {new Date(todo.created_at).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}
