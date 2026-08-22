import { SEARCH_ICONS, SEARCH_SECTIONS } from "../lib/search.js";

export default function SearchResults({
  id,
  className,
  status,
  results,
  searchedQuery,
  total,
  hint,
  onDismiss,
  onNavigate,
}) {
  const handleSelect = (sectionKey, item) => {
    onDismiss?.();

    if (sectionKey === "projects") {
      onNavigate(item.id);
      return;
    }

    onNavigate(
      item.project_id,
      sectionKey,
      searchedQuery,
      item.id,
      item.folder_path ?? [],
    );
  };

  return (
    <div id={id} className={className}>
      {status === "hint" && hint && <p className="search-hint">{hint}</p>}

      {status === "searching" && <p className="search-hint">Searching...</p>}

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
        SEARCH_SECTIONS.map(({ key, label }) => {
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
                      <i className={SEARCH_ICONS[key]} />
                    </span>
                    <div className="search-result-body">
                      <div className="search-result-title">{item.title}</div>
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
  );
}
