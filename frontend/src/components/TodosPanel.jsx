import { useEffect, useMemo, useRef, useState } from "react";
import TodoCard from "./TodoCard.jsx";
import TodoEditor from "./TodoEditor.jsx";
import TodoModal from "./TodoModal.jsx";
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

  const [isCreating, setIsCreating] = useState(false);
  const [viewingId, setViewingId] = useState(null);
  const [isEditingViewed, setIsEditingViewed] = useState(false);
  const [draft, setDraft] = useState(null);
  const [collapsedGroups, setCollapsedGroups] = useState(() =>
    readCollapsedGroups(projectId),
  );

  const { items, isLoading, error, reload, setItems } = useResourceList({
    projectId,
    fetchPage: fetchAllTodos,
  });

  const todos = useMemo(() => sortTodos(items, sort), [items, sort]);
  const viewedTodo = todos.find((todo) => todo.id === viewingId);

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

  const storeCollapsedGroups = (next) => {
    localStorage.setItem(
      `devnote_todo_collapsed_${projectId}`,
      JSON.stringify([...next]),
    );
    setCollapsedGroups(next);
  };

  const toggleGroup = (status) => {
    const next = new Set(collapsedGroups);

    if (next.has(status)) {
      next.delete(status);
    } else {
      next.add(status);
    }

    storeCollapsedGroups(next);
  };

  const startCreating = () => {
    if (collapsedGroups.has("pending")) {
      const next = new Set(collapsedGroups);
      next.delete("pending");
      storeCollapsedGroups(next);
    }

    setIsCreating(true);
  };

  const handleFieldChange = async (todo, field, value) => {
    if (value === todo[field]) return;

    const status = field === "status" ? value : undefined;
    const priority = field === "priority" ? value : undefined;

    try {
      await updateTodo(todo.id, undefined, undefined, status, priority);
      setItems((current) =>
        current.map((item) =>
          item.id === todo.id ? { ...item, [field]: value } : item,
        ),
      );
    } catch (fieldError) {
      console.error(`Error updating todo ${field}:`, fieldError);
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

      setIsCreating(false);
      setIsEditingViewed(false);
      setDraft(null);
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
      setViewingId((current) => (current === todoId ? null : current));
      await reload();
    } catch (deleteError) {
      console.error("Error deleting todo:", deleteError);
      await showAlert("Unable to delete the todo");
    }
  };

  const renderCreateCard = () =>
    isCreating && (
      <TodoEditor
        todo={null}
        usePortal={view === "kanban"}
        onSave={(values) => handleSave(null, values)}
        onCancel={() => setIsCreating(false)}
        onExpand={(values) => {
          setIsCreating(false);
          setDraft(values);
        }}
      />
    );

  const renderTodo = (todo) => (
    <TodoCard
      key={todo.id}
      todo={todo}
      searchQuery={searchQuery}
      usePortal={view === "kanban"}
      onOpen={() => setViewingId(todo.id)}
      onStatusChange={(status) => handleFieldChange(todo, "status", status)}
      onPriorityChange={(priority) =>
        handleFieldChange(todo, "priority", priority)
      }
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
      <div className="gallery-toolbar">
        <button
          type="button"
          className="gallery-action"
          onClick={startCreating}
        >
          <i className="ph-light ph-plus" />
          <span>New todo</span>
        </button>
      </div>

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
                  {isPending && renderCreateCard()}
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
                  {status === "pending" && renderCreateCard()}
                  {groupItems.map(renderTodo)}
                  {groupItems.length === 0 &&
                    !(status === "pending" && isCreating) && (
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

      {draft && (
        <TodoModal
          todo={draft}
          isEditing
          onCancelEdit={() => setDraft(null)}
          onSave={(values) => handleSave(null, values)}
          onClose={() => setDraft(null)}
        />
      )}

      {viewedTodo && (
        <TodoModal
          todo={viewedTodo}
          isEditing={isEditingViewed}
          onEdit={() => setIsEditingViewed(true)}
          onCancelEdit={() => setIsEditingViewed(false)}
          onSave={(values) => handleSave(viewedTodo.id, values)}
          onStatusChange={(status) =>
            handleFieldChange(viewedTodo, "status", status)
          }
          onPriorityChange={(priority) =>
            handleFieldChange(viewedTodo, "priority", priority)
          }
          onDelete={() => handleDelete(viewedTodo.id)}
          onClose={() => {
            setIsEditingViewed(false);
            setViewingId(null);
          }}
        />
      )}
    </div>
  );
}
