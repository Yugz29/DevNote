import { useEffect, useRef } from "react";

export default function SearchOverlay({ isOpen, onClose }) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  return (
    <div
      id="search-overlay"
      className={`search-overlay${isOpen ? " active" : ""}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="search-modal">
        <div className="search-input-wrapper">
          <span className="search-icon">
            <i className="ph-light ph-magnifying-glass" />
          </span>
          <input
            type="text"
            id="search-input"
            className="search-input"
            placeholder="Global search..."
            autoComplete="off"
            ref={inputRef}
          />
          <span className="search-shortcut">Esc</span>
        </div>

        <div id="search-results" className="search-results">
          <p className="search-hint">
            Search projects, notes, snippets and todos...
          </p>
        </div>
      </div>
    </div>
  );
}
