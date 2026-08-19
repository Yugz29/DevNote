import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import CardMenu from "./CardMenu.jsx";
import DnSelect from "./DnSelect.jsx";
import LanguageIcon from "./LanguageIcon.jsx";
import SidebarGroup from "./SidebarGroup.jsx";
import { useCopyStatus } from "../hooks/useCopyStatus.js";
import { useOrder } from "../hooks/useOrder.js";
import {
  PINNED_SECTIONS,
  SECTIONS_ORDER_KEY,
  itemsOrderKey,
} from "../lib/pinnedSections.js";
import {
  PRIORITY_BADGES,
  STATUS_BADGES,
  STATUS_OPTIONS,
} from "../lib/todos.js";

const COPY_STATES = {
  copied: { icon: "ph-check-circle", label: "Copied!" },
  failed: { icon: "ph-warning-circle", label: "Copy failed" },
};

const ACCESSIBILITY = {
  screenReaderInstructions: {
    draggable:
      "To reorder, press space or enter to pick up, use the arrow keys to " +
      "move, space or enter to drop, and escape to cancel.",
  },
  announcements: {
    onDragStart: ({ active }) => `Picked up ${active.data.current?.name}.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${active.data.current?.name} is over ${over.data.current?.name}.`
        : `${active.data.current?.name} is no longer over a drop target.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `${active.data.current?.name} was dropped over ${over.data.current?.name}.`
        : `${active.data.current?.name} was dropped.`,
    onDragCancel: ({ active }) =>
      `Reordering cancelled. ${active.data.current?.name} went back in place.`,
  },
};

function SortableRow({ id, container, name, children }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, data: { type: "item", container, name } });

  const handle = (
    <button
      type="button"
      className="pinned-drag-handle"
      aria-label={`Reorder ${name}`}
      {...attributes}
      {...listeners}
    >
      <i className="ph-light ph-dots-six-vertical" />
    </button>
  );

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`pinned-sortable${isDragging ? " is-dragging" : ""}`}
    >
      {children(handle)}
    </div>
  );
}

function PinnedDocument({ doc, isActive, handle, onOpen, onUnpin }) {
  return (
    <div className={`pinned-item${isActive ? " active" : ""}`} data-id={doc.id}>
      <button
        type="button"
        className="pinned-item-open"
        title={`Open ${doc.title}`}
        onClick={() => onOpen(doc)}
      >
        <i className="ph-light ph-file-text pinned-item-icon" />
        <span className="pinned-item-title">{doc.title}</span>
      </button>

      <div className="pinned-item-actions">
        {handle}
        <CardMenu
          label={`Actions for ${doc.title}`}
          items={[
            {
              label: "Unpin",
              icon: "ph-push-pin-slash",
              onSelect: () => onUnpin(doc),
            },
          ]}
        />
      </div>
    </div>
  );
}

function PinnedSnippet({ snippet, isActive, handle, onOpen, onUnpin }) {
  const { status, copy } = useCopyStatus();

  const state = COPY_STATES[status];

  return (
    <div
      className={`pinned-item${isActive ? " active" : ""}${state ? ` is-${status}` : ""}`}
      data-id={snippet.id}
    >
      <button
        type="button"
        className="pinned-item-open"
        title={`Copy ${snippet.title}`}
        onClick={() => copy(snippet.content)}
      >
        <LanguageIcon language={snippet.language} />
        <span className="pinned-item-title">{snippet.title}</span>
      </button>

      {state && (
        <span className="pinned-item-feedback" role="status">
          <i className={`ph-light ${state.icon}`} />
          {state.label}
        </span>
      )}

      <div className="pinned-item-actions">
        {handle}
        <CardMenu
          label={`Actions for ${snippet.title}`}
          items={[
            {
              label: "Open",
              icon: "ph-arrow-square-out",
              onSelect: () => onOpen(snippet),
            },
            {
              label: "Unpin",
              icon: "ph-push-pin-slash",
              onSelect: () => onUnpin(snippet),
            },
          ]}
        />
      </div>
    </div>
  );
}

function PinnedTodo({
  todo,
  isActive,
  handle,
  onOpen,
  onStatusChange,
  onUnpin,
}) {
  const status = STATUS_BADGES[todo.status] || STATUS_BADGES.pending;
  const priority = PRIORITY_BADGES[todo.priority] || PRIORITY_BADGES.medium;

  return (
    <div
      className={`pinned-item pinned-todo${isActive ? " active" : ""}${todo.status === "done" ? " is-done" : ""}`}
      data-id={todo.id}
    >
      <div className="pinned-todo-main">
        <button
          type="button"
          className="pinned-item-open"
          title={`Open ${todo.title} — ${priority.label} priority`}
          onClick={() => onOpen(todo)}
        >
          <span className={`pinned-todo-dot is-${todo.priority}`} />
          <span className="pinned-item-title">{todo.title}</span>
        </button>

        <div className="pinned-item-actions">
          {handle}
          <CardMenu
            label={`Actions for ${todo.title}`}
            items={[
              {
                label: "Unpin",
                icon: "ph-push-pin-slash",
                onSelect: () => onUnpin(todo),
              },
            ]}
          />
        </div>
      </div>

      <div className="pinned-todo-badges">
        <DnSelect
          value={todo.status}
          options={STATUS_OPTIONS}
          onChange={(next) => onStatusChange(todo, next)}
          usePortal
          label={`Status: ${status.label}`}
          triggerClassName={`todo-badge-select badge badge-mini ${status.class}`}
        />
      </div>
    </div>
  );
}

export default function SidebarPinned({
  projectId,
  documents,
  snippets,
  todos,
  isLoading,
  activeItemId,
  onOpenDocument,
  onOpenSnippet,
  onOpenTodo,
  onChangeTodoStatus,
  onUnpinDocument,
  onUnpinSnippet,
  onUnpinTodo,
}) {
  const [dragged, setDragged] = useState(null);

  const sectionsOrder = useOrder(SECTIONS_ORDER_KEY, PINNED_SECTIONS);
  const documentsOrder = useOrder(
    itemsOrderKey("documents", projectId),
    documents.items,
  );
  const snippetsOrder = useOrder(
    itemsOrderKey("snippets", projectId),
    snippets.items,
  );
  const todosOrder = useOrder(itemsOrderKey("todos", projectId), todos.items);

  /* Sections and items share one context, so a section dragged past a row
     would otherwise collide with it and be dropped as a type mismatch. Each
     drag only ever sees the droppables it is allowed to land on. */
  const collisionDetection = useCallback((args) => {
    const { type, container } = args.active.data.current ?? {};

    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter((droppable) => {
        const data = droppable.data.current ?? {};

        if (data.type !== type) return false;

        return type === "item" ? data.container === container : true;
      }),
    });
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const groups = {
    documents: { order: documentsOrder, count: documents.count },
    snippets: { order: snippetsOrder, count: snippets.count },
    todos: { order: todosOrder, count: todos.count },
  };

  const isEmpty = Object.values(groups).every(
    (group) => group.order.ordered.length === 0,
  );

  const handleDragEnd = ({ active, over }) => {
    setDragged(null);

    if (!over || active.id === over.id) return;

    const from = active.data.current;
    const to = over.data.current;

    if (from?.type !== to?.type) return;

    const list =
      from.type === "section"
        ? sectionsOrder
        : from.container === to.container
          ? groups[from.container].order
          : null;

    if (!list) return;

    const oldIndex = list.ordered.findIndex((entry) => entry.id === active.id);
    const newIndex = list.ordered.findIndex((entry) => entry.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    list.store(arrayMove(list.ordered, oldIndex, newIndex));
  };

  const renderItems = (sectionId) => {
    if (sectionId === "documents") {
      return documentsOrder.ordered.map((doc) => (
        <SortableRow
          key={doc.id}
          id={doc.id}
          container="documents"
          name={doc.title}
        >
          {(handle) => (
            <PinnedDocument
              doc={doc}
              handle={handle}
              isActive={doc.id === activeItemId}
              onOpen={onOpenDocument}
              onUnpin={onUnpinDocument}
            />
          )}
        </SortableRow>
      ));
    }

    if (sectionId === "snippets") {
      return snippetsOrder.ordered.map((snippet) => (
        <SortableRow
          key={snippet.id}
          id={snippet.id}
          container="snippets"
          name={snippet.title}
        >
          {(handle) => (
            <PinnedSnippet
              snippet={snippet}
              handle={handle}
              isActive={snippet.id === activeItemId}
              onOpen={onOpenSnippet}
              onUnpin={onUnpinSnippet}
            />
          )}
        </SortableRow>
      ));
    }

    return todosOrder.ordered.map((todo) => (
      <SortableRow
        key={todo.id}
        id={todo.id}
        container="todos"
        name={todo.title}
      >
        {(handle) => (
          <PinnedTodo
            todo={todo}
            handle={handle}
            isActive={todo.id === activeItemId}
            onOpen={onOpenTodo}
            onStatusChange={onChangeTodoStatus}
            onUnpin={onUnpinTodo}
          />
        )}
      </SortableRow>
    ));
  };

  const menuFor = (sectionId) => {
    const entries = [];

    if (groups[sectionId].order.isCustom) {
      entries.push({
        label: "Reset order",
        icon: "ph-arrow-counter-clockwise",
        onSelect: () => groups[sectionId].order.reset(),
      });
    }

    if (sectionsOrder.isCustom) {
      entries.push({
        label: "Reset section order",
        icon: "ph-arrow-counter-clockwise",
        onSelect: () => sectionsOrder.reset(),
      });
    }

    return entries;
  };

  if (isLoading) {
    return (
      <div id="pinned-list">
        <p className="loading">Loading pinned items...</p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      modifiers={[restrictToVerticalAxis]}
      accessibility={ACCESSIBILITY}
      onDragStart={({ active }) => setDragged(active.data.current)}
      onDragCancel={() => setDragged(null)}
      onDragEnd={handleDragEnd}
    >
      <div id="pinned-list">
        {isEmpty && (
          <div className="projects-empty">
            <i className="ph-light ph-push-pin" />
            <p>Nothing pinned yet</p>
            <span>
              Pin a document, a snippet or a todo
              <br />
              to keep it one click away
            </span>
          </div>
        )}

        <SortableContext
          items={sectionsOrder.ordered.map((section) => section.id)}
          strategy={verticalListSortingStrategy}
        >
          {sectionsOrder.ordered.map((section) => (
            <SidebarGroup
              key={section.id}
              id={section.id}
              label={section.label}
              items={groups[section.id].order.ordered}
              count={groups[section.id].count}
              storageKey={section.collapseKey}
              menuItems={menuFor(section.id)}
            >
              <SortableContext
                items={groups[section.id].order.ordered.map((item) => item.id)}
                strategy={verticalListSortingStrategy}
              >
                {renderItems(section.id)}
              </SortableContext>
            </SidebarGroup>
          ))}
        </SortableContext>
      </div>

      {createPortal(
        <DragOverlay>
          {dragged && (
            <div className={`pinned-drag-preview is-${dragged.type}`}>
              {dragged.name}
            </div>
          )}
        </DragOverlay>,
        document.body,
      )}
    </DndContext>
  );
}
