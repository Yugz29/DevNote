import { useEffect, useRef, useState } from "react";
import CardMenu from "./CardMenu.jsx";

export default function TodoListTabs({
  lists,
  counts,
  activeListId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}) {
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (!editingId) return;

    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editingId]);

  const cancel = () => {
    setEditingId(null);
    setDraft("");
  };

  const commit = () => {
    if (!editingId) return;

    const name = draft.trim();
    const current = lists.find((list) => list.id === editingId);

    if (!name || name === current?.name) {
      cancel();
      return;
    }

    if (editingId === "new") {
      onCreate(name);
    } else if (current) {
      onRename(current, name);
    }

    cancel();
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    }
  };

  const renderInput = (placeholder) => (
    <div className="todo-list-tab is-editing">
      <input
        ref={inputRef}
        className="todo-list-tab-input"
        value={draft}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={commit}
      />
    </div>
  );

  return (
    <div className="todo-list-tabs">
      <button
        type="button"
        className={`todo-list-tab is-open${activeListId === null ? " active" : ""}`}
        aria-pressed={activeListId === null}
        onClick={() => onSelect(null)}
      >
        <span>All</span>
        <span className="todo-list-tab-count">{counts.all}</span>
      </button>

      {lists.map((list) =>
        editingId === list.id ? (
          <div key={list.id}>{renderInput("List name...")}</div>
        ) : (
          <div
            key={list.id}
            className={`todo-list-tab${activeListId === list.id ? " active" : ""}`}
            data-id={list.id}
          >
            <button
              type="button"
              className="todo-list-tab-open"
              aria-pressed={activeListId === list.id}
              onClick={() => onSelect(list.id)}
            >
              <span>{list.name}</span>
              <span className="todo-list-tab-count">
                {counts.byList[list.id] ?? 0}
              </span>
            </button>

            <CardMenu
              label={`Actions for ${list.name}`}
              items={[
                {
                  label: "Rename",
                  icon: "ph-pencil-simple",
                  onSelect: () => {
                    setDraft(list.name);
                    setEditingId(list.id);
                  },
                },
                {
                  label: "Delete",
                  icon: "ph-trash",
                  isDanger: true,
                  onSelect: () => onDelete(list),
                },
              ]}
            />
          </div>
        ),
      )}

      {editingId === "new" && renderInput("New list...")}

      <button
        type="button"
        className="todo-list-tab is-add"
        onClick={() => {
          setDraft("");
          setEditingId("new");
        }}
      >
        <i className="ph-light ph-plus" />
        <span>New list</span>
      </button>
    </div>
  );
}
