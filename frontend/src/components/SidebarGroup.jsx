import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import CardMenu from "./CardMenu.jsx";
import { useLocalStorageState } from "../hooks/useLocalStorageState.js";

export default function SidebarGroup({
  id,
  label,
  items,
  count,
  storageKey,
  menuItems = [],
  children,
}) {
  const [collapsed, setCollapsed] = useLocalStorageState(storageKey, "false");

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, data: { type: "section", name: label } });

  const isCollapsed = collapsed === "true";

  if (items.length === 0) return null;

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`pinned-group${isDragging ? " is-dragging" : ""}`}
    >
      <div className="pinned-group-header">
        <button
          type="button"
          className="pinned-group-toggle"
          aria-expanded={!isCollapsed}
          onClick={() => setCollapsed(isCollapsed ? "false" : "true")}
        >
          <i
            className={`ph-light ph-caret-down pinned-group-caret${isCollapsed ? " rotated" : ""}`}
          />
          <span>{label}</span>
        </button>

        {count > items.length && (
          <span className="pinned-group-count">
            {items.length} of {count}
          </span>
        )}

        <div className="pinned-group-actions">
          <button
            type="button"
            className="pinned-drag-handle"
            aria-label={`Reorder the ${label} section`}
            {...attributes}
            {...listeners}
          >
            <i className="ph-light ph-dots-six-vertical" />
          </button>

          {menuItems.length > 0 && (
            <CardMenu label={`Actions for ${label}`} items={menuItems} />
          )}
        </div>
      </div>

      {!isCollapsed && children}
    </section>
  );
}
