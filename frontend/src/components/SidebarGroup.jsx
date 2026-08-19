import { useLocalStorageState } from "../hooks/useLocalStorageState.js";

export default function SidebarGroup({
  label,
  items,
  count,
  storageKey,
  children,
}) {
  const [collapsed, setCollapsed] = useLocalStorageState(storageKey, "false");

  const isCollapsed = collapsed === "true";

  if (items.length === 0) return null;

  return (
    <section className="pinned-group">
      <button
        type="button"
        className="pinned-group-header"
        aria-expanded={!isCollapsed}
        onClick={() => setCollapsed(isCollapsed ? "false" : "true")}
      >
        <i
          className={`ph-light ph-caret-down pinned-group-caret${isCollapsed ? " rotated" : ""}`}
        />
        <span>{label}</span>
        {count > items.length && (
          <span className="pinned-group-count">
            {items.length} of {count}
          </span>
        )}
      </button>

      {!isCollapsed && children}
    </section>
  );
}
