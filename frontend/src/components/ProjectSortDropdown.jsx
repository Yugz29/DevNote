import { useCallback, useRef, useState } from "react";
import { useClickOutside } from "../hooks/useClickOutside.js";
import { useOrder } from "../hooks/useOrder.js";

const SORT_OPTIONS = [
  { value: "created_desc", label: "Newest first" },
  { value: "created_asc", label: "Oldest first" },
  { value: "updated_desc", label: "Recently updated" },
  { value: "name_asc", label: "Name A → Z" },
  { value: "name_desc", label: "Name Z → A" },
];

const SORT_ICONS = {
  name_asc: "ph-sort-ascending",
  name_desc: "ph-sort-descending",
  created_desc: "ph-sort-ascending",
  created_asc: "ph-sort-descending",
  updated_desc: "ph-clock-clockwise",
};

const EMPTY_LIST = [];

export default function ProjectSortDropdown({ sort, orderKey, onSortChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapRef = useRef(null);

  const close = useCallback(() => setIsOpen(false), []);
  useClickOutside(wrapRef, close, isOpen);

  /* Reads the same key the list writes to, so the entry appears as soon as
     something has been dragged and disappears once the order is cleared. */
  const { isCustom, reset } = useOrder(orderKey, EMPTY_LIST);

  return (
    <div className="project-sort-wrap" ref={wrapRef}>
      <button
        id="project-sort-btn"
        className={`btn-icon-sm${sort !== "created_desc" ? " sorted" : ""}`}
        title="Sort projects"
        onClick={() => setIsOpen((current) => !current)}
      >
        <i className={`ph-light ${SORT_ICONS[sort] || "ph-sort-ascending"}`} />
      </button>

      <div
        id="project-sort-dropdown"
        className={`project-sort-dropdown${isOpen ? " open" : ""}`}
      >
        {SORT_OPTIONS.map((option) => (
          <button
            key={option.value}
            className={`sort-option${!isCustom && option.value === sort ? " active" : ""}`}
            onClick={() => {
              onSortChange(option.value);
              setIsOpen(false);
            }}
          >
            {option.label}
          </button>
        ))}

        {isCustom && (
          <button
            className="sort-option is-reset"
            onClick={() => {
              reset();
              setIsOpen(false);
            }}
          >
            <i className="ph-light ph-arrow-counter-clockwise" />
            Reset custom order
          </button>
        )}
      </div>
    </div>
  );
}
