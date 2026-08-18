import { useCallback, useRef, useState } from "react";
import { useClickOutside } from "../hooks/useClickOutside.js";

export default function CardMenu({ label, items }) {
  const wrapRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const close = useCallback(() => setIsOpen(false), []);

  useClickOutside(wrapRef, close, isOpen);

  const handleKeyDown = (event) => {
    if (event.key !== "Escape" || !isOpen) return;

    event.stopPropagation();
    close();
  };

  return (
    <div className="card-menu" ref={wrapRef} onKeyDown={handleKeyDown}>
      <button
        type="button"
        className={`card-menu-trigger${isOpen ? " open" : ""}`}
        title={label}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <i className="ph-light ph-dots-three" />
      </button>

      <div className={`card-menu-dropdown${isOpen ? " open" : ""}`} role="menu">
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            className={`card-menu-item${item.isDanger ? " is-danger" : ""}`}
            onClick={() => {
              close();
              item.onSelect();
            }}
          >
            <i className={`ph-light ${item.icon}`} />
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
