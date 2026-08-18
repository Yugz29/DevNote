import DnSelect from "./DnSelect.jsx";
import HighlightText from "./HighlightText.jsx";
import {
  PRIORITY_BADGES,
  PRIORITY_OPTIONS,
  STATUS_BADGES,
  STATUS_OPTIONS,
} from "../lib/todos.js";

export default function TodoCard({
  todo,
  searchQuery,
  usePortal,
  onOpen,
  onStatusChange,
  onPriorityChange,
  onDelete,
}) {
  const priority = PRIORITY_BADGES[todo.priority] || PRIORITY_BADGES.medium;
  const status = STATUS_BADGES[todo.status] || STATUS_BADGES.pending;

  return (
    <div
      className={`todo-card ${todo.status === "done" ? "is-done" : ""}`}
      data-id={todo.id}
      onClick={onOpen}
    >
      <div
        className="todo-card-header"
        onClick={(event) => event.stopPropagation()}
      >
        <DnSelect
          value={todo.status}
          options={STATUS_OPTIONS}
          onChange={onStatusChange}
          usePortal={usePortal}
          label={`Status: ${status.label}`}
          triggerClassName={`todo-badge-select badge ${status.class}`}
        />

        <button type="button" className="todo-title-btn" onClick={onOpen}>
          <HighlightText text={todo.title} query={searchQuery} />
        </button>

        <div className="item-actions">
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
        <div
          className="todo-card-priority"
          onClick={(event) => event.stopPropagation()}
        >
          <DnSelect
            value={todo.priority}
            options={PRIORITY_OPTIONS}
            onChange={onPriorityChange}
            usePortal={usePortal}
            label={`Priority: ${priority.label}`}
            triggerClassName={`todo-badge-select badge ${priority.class}`}
          />
        </div>
        <span className="card-date">
          {new Date(todo.created_at).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}
