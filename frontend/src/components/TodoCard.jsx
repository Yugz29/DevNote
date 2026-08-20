import CardMenu from "./CardMenu.jsx";
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
  onMove,
  onTogglePin,
  onDelete,
}) {
  const priority = PRIORITY_BADGES[todo.priority] || PRIORITY_BADGES.medium;
  const status = STATUS_BADGES[todo.status] || STATUS_BADGES.pending;

  return (
    <div
      className={`todo-card ${todo.status === "done" ? "is-done" : ""}`}
      data-id={todo.id}
      data-priority={todo.priority}
      onClick={onOpen}
    >
      <div
        className="todo-card-meta"
        onClick={(event) => event.stopPropagation()}
      >
        <DnSelect
          value={todo.priority}
          options={PRIORITY_OPTIONS}
          onChange={onPriorityChange}
          usePortal={usePortal}
          label={`Priority: ${priority.label}`}
          triggerClassName="todo-meta-priority"
        />

        <span className="todo-meta-sep">/</span>

        <DnSelect
          value={todo.status}
          options={STATUS_OPTIONS}
          onChange={onStatusChange}
          usePortal={usePortal}
          label={`Status: ${status.label}`}
          triggerClassName="todo-meta-status"
        />

        <div className="item-actions">
          <CardMenu
            label={`Actions for ${todo.title}`}
            items={[
              {
                label: todo.is_pinned ? "Unpin" : "Pin",
                icon: todo.is_pinned ? "ph-push-pin-slash" : "ph-push-pin",
                onSelect: onTogglePin,
              },
              {
                label: "Move to…",
                icon: "ph-arrow-elbow-down-right",
                onSelect: onMove,
              },
              {
                label: "Delete",
                icon: "ph-trash",
                isDanger: true,
                onSelect: onDelete,
              },
            ]}
          />
        </div>
      </div>

      <button type="button" className="todo-title-btn" onClick={onOpen}>
        <HighlightText text={todo.title} query={searchQuery} />
      </button>

      {todo.description && (
        <p className="todo-description">
          <HighlightText text={todo.description} query={searchQuery} />
        </p>
      )}

      <div className="todo-card-footer">
        <span className="card-date">
          {todo.is_pinned && (
            <i className="ph-light ph-push-pin gallery-card-pin" />
          )}
          {new Date(todo.created_at).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}
