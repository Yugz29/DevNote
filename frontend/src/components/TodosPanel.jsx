import { useEffect, useMemo, useRef, useState } from "react";
import TodoCard from "./TodoCard.jsx";
import TodoEditor from "./TodoEditor.jsx";
import { useDialog } from "../contexts/DialogContext.js";
import { useResourceList } from "../hooks/useResourceList.js";
import { useSearchTarget } from "../hooks/useSearchTarget.js";
import {
  PRIORITY_ORDER,
  STATUSES,
  STATUS_BADGES,
  STATUS_LABELS,
} from "../lib/todos.js";
import {
  createTodo,
  deleteTodo,
  getAllTodos,
  updateTodo,
} from "../services/todoService.js";

async function fetchAllTodos(projectId) {
  return { results: await getAllTodos(projectId), next: null };
}

function sortTodos(todos, sort) {
  return [...todos].sort((a, b) => {
    if (sort === "priority") {
      return (
        (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1)
      );
    }
    if (sort === "updated") {
      return new Date(b.updated_at) - new Date(a.updated_at);
    }
    return new Date(b.created_at) - new Date(a.created_at);
  });
}

function readCollapsedGroups(projectId) {
  const stored = localStorage.getItem(`devnote_todo_collapsed_${projectId}`);
  return new Set(stored ? JSON.parse(stored) : []);
}

export default function TodosPanel({
  projectId,
  sort,
  view,
  searchQuery,
  searchItemId,
  onSortableChange,
}) {
  const { showAlert, showConfirm } = useDialog();
  const containerRef = useRef(null);

  const [editingId, setEditingId] = useState(null);
  const [collapsedGroups, setCollapsedGroups] = useState(() =>
    readCollapsedGroups(projectId),
  );

  const { items, isLoading, error, reload, setItems } = useResourceList({
    projectId,
    fetchPage: fetchAllTodos,
  });

  const todos = useMemo(() => sortTodos(items, sort), [items, sort]);

  useSearchTarget(containerRef, searchItemId, !isLoading && todos.length > 0);

  const isSortable = !isLoading && !error && todos.length > 1;

  useEffect(() => {
    onSortableChange(isSortable);
  }, [onSortableChange, isSortable]);

  const groups = useMemo(
    () =>
      Object.fromEntries(
        STATUSES.map((status) => [
          status,
          todos.filter((todo) => todo.status === status),
        ]),
      ),
    [todos],
  );

  const toggleGroup = (status) => {
    const next = new Set(collapsedGroups);

    if (next.has(status)) {
      next.delete(status);
    } else {
      next.add(status);
    }

    localStorage.setItem(
      `devnote_todo_collapsed_${projectId}`,
      JSON.stringify([...next]),
    );
    setCollapsedGroups(next);
  };

  const handleStatusChange = async (todo, newStatus) => {
    if (newStatus === todo.status) return;

    try {
      await updateTodo(todo.id, undefined, undefined, newStatus, undefined);
      setItems((current) =>
        current.map((item) =>
          item.id === todo.id ? { ...item, status: newStatus } : item,
        ),
      );
    } catch (statusError) {
      console.error("Error updating todo status:", statusError);
    }
  };

  const handleSave = async (todoId, values) => {
    const title = values.title.trim();
    const description = values.description.trim();

    if (!title) {
      await showAlert("Title is required", "info");
      return;
    }

    try {
      if (todoId) {
        await updateTodo(
          todoId,
          title,
          description,
          values.status,
          values.priority,
        );
      } else {
        await createTodo(
          projectId,
          title,
          description,
          values.status,
          values.priority,
        );
      }

      setEditingId(null);
      await reload();
    } catch (saveError) {
      console.error("Error saving todo:", saveError);
      await showAlert("Unable to save the todo");
    }
  };

  const handleDelete = async (todoId) => {
    const confirmed = await showConfirm("Delete this todo?");
    if (!confirmed) return;

    try {
      await deleteTodo(todoId);
      await reload();
    } catch (deleteError) {
      console.error("Error deleting todo:", deleteError);
      await showAlert("Unable to delete the todo");
    }
  };

  const renderAddCard = () =>
    editingId === "new" ? (
      <TodoEditor
        todo={null}
        usePortal={view === "kanban"}
        onSave={(values) => handleSave(null, values)}
        onCancel={() => setEditingId(null)}
      />
    ) : (
      <div
        className="snippet-add-card todo-add-card"
        id="todo-add-line"
        onClick={() => {
          if (editingId === null) setEditingId("new");
        }}
      >
        <span className="note-add-icon">+</span>
        <span className="note-add-text">New todo...</span>
      </div>
    );

  const renderTodo = (todo) =>
    editingId === todo.id ? (
      <TodoEditor
        key={todo.id}
        todo={todo}
        usePortal={view === "kanban"}
        onSave={(values) => handleSave(todo.id, values)}
        onCancel={() => setEditingId(null)}
      />
    ) : (
      <TodoCard
        key={todo.id}
        todo={todo}
        searchQuery={searchQuery}
        usePortal={view === "kanban"}
        onStatusChange={(status) => handleStatusChange(todo, status)}
        onEdit={() => {
          if (editingId === null) setEditingId(todo.id);
        }}
        onDelete={() => handleDelete(todo.id)}
      />
    );

  const renderGroupHeader = (status, count, className) => {
    const badge = STATUS_BADGES[status];
    const isCollapsed = collapsedGroups.has(status);

    return (
      <div className={className}>
        <button
          className="btn-toggle-group"
          data-status={status}
          title="Toggle"
          onClick={() => toggleGroup(status)}
        >
          <i
            className={`ph-light ph-caret-down${isCollapsed ? " rotated" : ""}`}
          />
        </button>
        <span className={`badge ${badge.class}`}>{badge.label}</span>
        <span className="todo-group-count">{count}</span>
      </div>
    );
  };

  return (
    <div id="todos-list" className="todos-list" ref={containerRef}>
      {isLoading && <p className="loading">Loading...</p>}

      {!isLoading && error && <p className="error">{error}</p>}

      {!isLoading && !error && view === "kanban" && (
        <div className="todo-kanban-view">
          {STATUSES.map((status) => {
            const groupItems = groups[status];
            const isCollapsed = collapsedGroups.has(status);
            const isPending = status === "pending";

            return (
              <div
                key={status}
                className={`kanban-column${isCollapsed ? " collapsed" : ""}`}
                data-status={status}
              >
                {renderGroupHeader(
                  status,
                  groupItems.length,
                  "kanban-column-header",
                )}

                <div
                  className={`kanban-column-items${groupItems.length === 0 ? " kanban-column-empty" : ""}`}
                >
                  {isPending && renderAddCard()}
                  {groupItems.map(renderTodo)}
                  {groupItems.length === 0 && !isPending && (
                    <p className="todo-group-empty">Empty</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!isLoading && !error && view !== "kanban" && (
        <div className="todo-list-view">
          {STATUSES.map((status) => {
            const groupItems = groups[status];
            const isCollapsed = collapsedGroups.has(status);

            return (
              <div key={status} className="todo-group" data-status={status}>
                {renderGroupHeader(
                  status,
                  groupItems.length,
                  "todo-group-header",
                )}

                <div
                  className={`todo-group-items${isCollapsed ? " collapsed" : ""}`}
                >
                  {status === "pending" && renderAddCard()}
                  {groupItems.length > 0 ? (
                    groupItems.map(renderTodo)
                  ) : (
                    <p className="todo-group-empty">
                      No {STATUS_LABELS[status].toLowerCase()} todos
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
