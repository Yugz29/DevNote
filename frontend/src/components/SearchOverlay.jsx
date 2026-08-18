import { useCallback, useEffect, useRef, useState } from "react";
import { search } from "../services/searchService.js";

const SECTIONS = [
  { key: "projects", label: "Projects" },
  { key: "notes", label: "Notes" },
  { key: "snippets", label: "Snippets" },
  { key: "todos", label: "TODOs" },
];

const ICONS = {
  projects: "ph-light ph-folder",
  notes: "ph-light ph-note",
  snippets: "ph-light ph-code",
  todos: "ph-light ph-check-square",
};

export default function SearchOverlay({ isOpen, onClose, onSelectResult }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("hint");
  const [results, setResults] = useState(null);
  const [searchedQuery, setSearchedQuery] = useState("");

  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [isOpen]);

  const close = useCallback(() => {
    clearTimeout(debounceRef.current);
    setQuery("");
    setStatus("hint");
    setResults(null);
    setSearchedQuery("");
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event) => {
      if (event.key === "Escape") close();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, close]);

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const runSearch = async (value) => {
    setStatus("searching");

    try {
      const data = await search(value);
      setResults(data);
      setSearchedQuery(value);
      setStatus("done");
    } catch (searchError) {
      console.error("Search error:", searchError);
      setStatus("error");
    }
  };

  const handleChange = (event) => {
    const value = event.target.value;
    setQuery(value);
    clearTimeout(debounceRef.current);

    const trimmed = value.trim();

    if (!trimmed) {
      setStatus("hint");
      setResults(null);
      return;
    }

    debounceRef.current = setTimeout(() => runSearch(trimmed), 300);
  };

  const handleSelect = (sectionKey, item) => {
    close();

    if (sectionKey === "projects") {
      onSelectResult(item.id);
      return;
    }

    onSelectResult(item.project_id, sectionKey, searchedQuery, item.id);
  };

  const total = SECTIONS.reduce(
    (count, section) => count + (results?.[section.key]?.length || 0),
    0,
  );

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
            onChange={handleChange}
          />
          <span className="search-shortcut">Esc</span>
        </div>

        <div id="search-results" className="search-results">
          {status === "hint" && (
            <p className="search-hint">
              Search projects, notes, snippets and todos...
            </p>
          )}

          {status === "searching" && (
            <p className="search-hint">Searching...</p>
          )}

          {status === "error" && (
            <p className="search-empty">Search failed. Please try again.</p>
          )}

          {status === "done" && total === 0 && (
            <p className="search-empty">
              No results for &quot;<strong>{searchedQuery}</strong>&quot;
            </p>
          )}

          {status === "done" &&
            total > 0 &&
            SECTIONS.map(({ key, label }) => {
              const items = results?.[key];
              if (!items?.length) return null;

              return (
                <div key={key}>
                  <div className="search-section-title">{label}</div>

                  {items.map((item) => {
                    const projectId =
                      key === "projects" ? item.id : item.project_id;
                    const meta =
                      key === "projects"
                        ? item.description || ""
                        : item.content || item.description || "";

                    return (
                      <div
                        key={item.id}
                        className="search-result-item"
                        data-type={key}
                        data-id={item.id}
                        data-project={projectId}
                        onClick={() => handleSelect(key, item)}
                      >
                        <span className="search-result-icon">
                          <i className={ICONS[key]} />
                        </span>
                        <div className="search-result-body">
                          <div className="search-result-title">
                            {item.title}
                          </div>
                          {meta && (
                            <div className="search-result-meta">
                              {meta.substring(0, 60)}
                              {meta.length > 60 ? "..." : ""}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
