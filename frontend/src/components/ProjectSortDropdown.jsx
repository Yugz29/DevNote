import { useCallback, useRef, useState } from "react";
import { useClickOutside } from "../hooks/useClickOutside.js";

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

export default function ProjectSortDropdown({ sort, onSortChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapRef = useRef(null);

  const close = useCallback(() => setIsOpen(false), []);
  useClickOutside(wrapRef, close, isOpen);

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
            className={`sort-option${option.value === sort ? " active" : ""}`}
            onClick={() => {
              onSortChange(option.value);
              setIsOpen(false);
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
