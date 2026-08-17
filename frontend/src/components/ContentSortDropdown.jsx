import { useCallback, useRef } from "react";
import { useClickOutside } from "../hooks/useClickOutside.js";

export default function ContentSortDropdown({
  id,
  options,
  sort,
  defaultSort,
  isOpen,
  onToggle,
  onSortChange,
}) {
  const wrapRef = useRef(null);
  const close = useCallback(() => onToggle(false), [onToggle]);

  useClickOutside(wrapRef, close, isOpen);

  const activeOption = options.find((option) => option.value === sort);

  return (
    <div className="content-sort-wrap" ref={wrapRef}>
      <button
        id={`${id}-sort-btn`}
        className={`content-sort-btn${sort !== defaultSort ? " active" : ""}`}
        onClick={() => onToggle(!isOpen)}
      >
        <i className="ph-light ph-sort-ascending" />
        <span id={`${id}-sort-label`}>
          {activeOption ? activeOption.label : ""}
        </span>
        <i
          className="ph-light ph-caret-down sort-chevron"
          style={{ transform: isOpen ? "rotate(180deg)" : "" }}
        />
      </button>

      <div
        id={`${id}-sort-dropdown`}
        className={`project-sort-dropdown${isOpen ? " open" : ""}`}
      >
        {options.map((option) => (
          <button
            key={option.value}
            className={`sort-option${option.value === sort ? " active" : ""}`}
            onClick={() => {
              onSortChange(option.value);
              onToggle(false);
            }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
