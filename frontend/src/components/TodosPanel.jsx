import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import TodoCard from "./TodoCard.jsx";
import TodoEditor from "./TodoEditor.jsx";
import TodoListTabs from "./TodoListTabs.jsx";
import TodoModal from "./TodoModal.jsx";
import TodoMoveDialog from "./TodoMoveDialog.jsx";
import { useDialog } from "../contexts/DialogContext.js";
import { useResourceList } from "../hooks/useResourceList.js";
import { shouldUnpinOnDone } from "../lib/todoPinRule.js";
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
  moveTodo,
  setTodoPinned,
  updateTodo,
} from "../services/todoService.js";
import {
  createTodoList,
  deleteTodoList,
  getTodoLists,
  renameTodoList,
} from "../services/todoListService.js";

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

function readActiveList(projectId) {
  return localStorage.getItem(`devnote_todo_active_list_${projectId}`) || null;
}

function writeActiveList(projectId, listId) {
  const key = `devnote_todo_active_list_${projectId}`;

  if (listId) {
    localStorage.setItem(key, listId);
    return;
  }

  localStorage.removeItem(key);
}

export default function TodosPanel({
  projectId,
  sort,
  view,
  searchQuery,
  searchItemId,
  openTarget,
  contentVersion,
  onPinnedChanged,
  onActiveItemChange,
  onSortableChange,
}) {
  const { showAlert, showConfirm } = useDialog();
  const containerRef = useRef(null);
  const versionRef = useRef(contentVersion);

  const [isCreating, setIsCreating] = useState(false);
  const [viewingId, setViewingId] = useState(null);
  const [isEditingViewed, setIsEditingViewed] = useState(false);
  const [draft, setDraft] = useState(null);
  const [movingTodo, setMovingTodo] = useState(null);
  const [collapsedGroups, setCollapsedGroups] = useState(() =>
    readCollapsedGroups(projectId),
  );
  const [lists, setLists] = useState([]);
  const [activeListId, setActiveListId] = useState(() =>
    searchItemId ? null : readActiveList(projectId),
  );
  const [openRequest, setOpenRequest] = useState(null);

  if (openTarget !== openRequest) {
    setOpenRequest(openTarget);

    if (openTarget) {
      setViewingId(openTarget.itemId);
      setIsEditingViewed(false);
    }
  }

  const { items, isLoading, error, reload, setItems } = useResourceList({
    projectId,
    fetchPage: fetchAllTodos,
  });

  const todos = useMemo(() => sortTodos(items, sort), [items, sort]);
  const viewedTodo = todos.find((todo) => todo.id === viewingId);

  const visibleTodos = useMemo(
    () =>
      activeListId === null
        ? todos
        : todos.filter((todo) => todo.list === activeListId),
    [todos, activeListId],
  );

  const counts = useMemo(() => {
    const byList = {};

    for (const todo of items) {
      if (todo.list) byList[todo.list] = (byList[todo.list] ?? 0) + 1;
    }

    return { all: items.length, byList };
  }, [items]);

  const loadLists = useCallback(() => {
    if (!projectId) return Promise.resolve();

    return getTodoLists(projectId)
      .then((data) => {
        const results = data.results ?? data;
        setLists(results);
        setActiveListId((current) =>
          current && !results.some((list) => list.id === current)
            ? null
            : current,
        );
      })
      .catch((listError) => {
        console.error("Error loading todo lists:", listError);
        setLists([]);
      });
  }, [projectId]);

  useEffect(() => {
    loadLists();
  }, [loadLists]);

  useEffect(() => {
    onActiveItemChange(viewingId);

    return () => onActiveItemChange(null);
  }, [viewingId, onActiveItemChange]);

  useEffect(() => {
    if (versionRef.current === contentVersion) return;

    versionRef.current = contentVersion;
    reload();
  }, [contentVersion, reload]);

  const selectList = (listId) => {
    writeActiveList(projectId, listId);
    setActiveListId(listId);
    setIsCreating(false);
  };

  useSearchTarget(
    containerRef,
    searchItemId,
    !isLoading && visibleTodos.length > 0,
  );

  const isSortable = !isLoading && !error && visibleTodos.length > 1;

  useEffect(() => {
    onSortableChange(isSortable);
  }, [onSortableChange, isSortable]);

  const groups = useMemo(
    () =>
      Object.fromEntries(
        STATUSES.map((status) => [
          status,
          visibleTodos.filter((todo) => todo.status === status),
        ]),
      ),
    [visibleTodos],
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
      const unpins = field === "status" && shouldUnpinOnDone(todo, value);

      if (unpins) await setTodoPinned(todo.id, false);

      setItems((current) =>
        current.map((item) =>
          item.id === todo.id
            ? { ...item, [field]: value, ...(unpins && { is_pinned: false }) }
            : item,
        ),
      );

      if (todo.is_pinned) onPinnedChanged();
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

        const saved = items.find((item) => item.id === todoId);

        if (shouldUnpinOnDone(saved, values.status)) {
          await setTodoPinned(todoId, false);
        }
      } else {
        await createTodo(
          projectId,
          title,
          description,
          values.status,
          values.priority,
          activeListId,
        );
      }

      setIsCreating(false);
      setIsEditingViewed(false);
      setDraft(null);
      await reload();
      onPinnedChanged();
    } catch (saveError) {
      console.error("Error saving todo:", saveError);
      await showAlert("Unable to save the todo");
    }
  };

  const handleCreateList = async (name) => {
    try {
      const created = await createTodoList(projectId, name);
      await loadLists();
      selectList(created.id);
    } catch (createError) {
      console.error("Error creating todo list:", createError);
      await showAlert(
        createError?.response?.data?.name?.[0] ?? "Unable to create the list",
      );
    }
  };

  const handleRenameList = async (list, name) => {
    try {
      await renameTodoList(list.id, name);
      await loadLists();
    } catch (renameError) {
      console.error("Error renaming todo list:", renameError);
      await showAlert(
        renameError?.response?.data?.name?.[0] ?? "Unable to rename the list",
      );
    }
  };

  const handleDeleteList = async (list) => {
    const held = counts.byList[list.id] ?? 0;

    if (held > 0) {
      const confirmed = await showConfirm(
        `Delete "${list.name}"? Its ${held} todo${held > 1 ? "s" : ""} ` +
          "will be left unclassified.",
      );

      if (!confirmed) return;
    }

    try {
      await deleteTodoList(list.id);

      if (activeListId === list.id) selectList(null);

      await Promise.all([reload(), loadLists()]);
    } catch (deleteError) {
      console.error("Error deleting todo list:", deleteError);
      await showAlert("Unable to delete the list");
    }
  };

  const handleTogglePin = async (todo) => {
    const nextPinned = !todo.is_pinned;

    try {
      await setTodoPinned(todo.id, nextPinned);
    } catch (pinError) {
      console.error("Error pinning todo:", pinError);
      await showAlert(`Unable to ${nextPinned ? "pin" : "unpin"} the todo`);
      return;
    }

    setItems((current) =>
      current.map((item) =>
        item.id === todo.id ? { ...item, is_pinned: nextPinned } : item,
      ),
    );

    onPinnedChanged();
  };

  const handleMoveTodo = async (listId) => {
    const todo = movingTodo;

    try {
      await moveTodo(todo.id, listId);
      setItems((current) =>
        current.map((item) =>
          item.id === todo.id ? { ...item, list: listId } : item,
        ),
      );
      setMovingTodo(null);
    } catch (moveError) {
      console.error("Error moving todo:", moveError);
      await showAlert("Unable to move the todo");
    }
  };

  const handleDelete = async (todoId) => {
    const confirmed = await showConfirm("Delete this todo?");
    if (!confirmed) return;

    try {
      await deleteTodo(todoId);
      setViewingId((current) => (current === todoId ? null : current));
      await reload();
      onPinnedChanged();
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
      onMove={() => setMovingTodo(todo)}
      onTogglePin={() => handleTogglePin(todo)}
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
      <TodoListTabs
        lists={lists}
        counts={counts}
        activeListId={activeListId}
        onSelect={selectList}
        onCreate={handleCreateList}
        onRename={handleRenameList}
        onDelete={handleDeleteList}
      />

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
          onMove={() => {
            setViewingId(null);
            setMovingTodo(viewedTodo);
          }}
          onTogglePin={() => handleTogglePin(viewedTodo)}
          onDelete={() => handleDelete(viewedTodo.id)}
          onClose={() => {
            setIsEditingViewed(false);
            setViewingId(null);
          }}
        />
      )}

      {movingTodo && (
        <TodoMoveDialog
          todo={movingTodo}
          lists={lists}
          onCancel={() => setMovingTodo(null)}
          onMove={handleMoveTodo}
        />
      )}
    </div>
  );
}
