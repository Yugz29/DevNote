import { useCallback, useEffect, useRef } from "react";
import SearchResults from "./SearchResults.jsx";
import { useGlobalSearch } from "../hooks/useGlobalSearch.js";

export default function SearchOverlay({ isOpen, onClose, onSelectResult }) {
  const { query, status, results, searchedQuery, total, changeQuery, reset } =
    useGlobalSearch();

  const inputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [isOpen]);

  const close = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event) => {
      if (event.key === "Escape") close();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, close]);

  const handleSelect = (sectionKey, item) => {
    close();

    if (sectionKey === "projects") {
      onSelectResult(item.id);
      return;
    }

    onSelectResult(item.project_id, sectionKey, searchedQuery, item.id);
  };

  return (
    <div
      id="search-overlay"
      className={`search-overlay${isOpen ? " active" : ""}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
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
            value={query}
            onChange={(event) => changeQuery(event.target.value)}
          />
          <span className="search-shortcut">Esc</span>
        </div>

        <SearchResults
          id="search-results"
          className="search-results"
          status={status}
          results={results}
          searchedQuery={searchedQuery}
          total={total}
          hint="Search projects, documents, snippets and todos..."
          onSelect={handleSelect}
        />
      </div>
    </div>
  );
}
