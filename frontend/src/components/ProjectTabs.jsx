import { useCallback, useEffect, useRef, useState } from "react";
import ContentSortDropdown from "./ContentSortDropdown.jsx";
import DocumentsPanel from "./DocumentsPanel.jsx";
import SnippetsPanel from "./SnippetsPanel.jsx";
import TodosPanel from "./TodosPanel.jsx";
import { useLocalStorageState } from "../hooks/useLocalStorageState.js";
import { search } from "../services/searchService.js";

const TABS = [
  { key: "documents", label: "Documents" },
  { key: "snippets", label: "Code Snippets" },
  { key: "todos", label: "TODOs" },
];

const DOCUMENT_SORT_OPTIONS = [
  { value: "created", label: "Created" },
  { value: "updated", label: "Updated" },
  { value: "title", label: "Title A → Z" },
];

const SNIPPET_SORT_OPTIONS = DOCUMENT_SORT_OPTIONS;

const TODO_SORT_OPTIONS = [
  { value: "priority", label: "Priority" },
  { value: "created", label: "Created" },
  { value: "updated", label: "Updated" },
];

export default function ProjectTabs({
  projectId,
  currentTab,
  onTabChange,
  headerSlot,
  searchQuery,
  searchItemId,
  openTarget,
  contentVersion,
  onPinnedChanged,
  onActiveItemChange,
}) {
  const tabContentRef = useRef(null);
  const searchInputRef = useRef(null);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [isSortable, setIsSortable] = useState(false);
  const [breadcrumbSlot, setBreadcrumbSlot] = useState(null);
  const [sortableTab, setSortableTab] = useState(currentTab);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchDraft, setSearchDraft] = useState("");
  const [searchStatus, setSearchStatus] = useState("idle");
  const [sectionSearch, setSectionSearch] = useState(null);

  const closeSectionSearch = useCallback(() => {
    setIsSearchOpen(false);
    setSearchDraft("");
    setSearchStatus("idle");
    setSectionSearch(null);
  }, []);

  if (sortableTab !== currentTab) {
    setSortableTab(currentTab);
    setIsSortable(false);
    setIsSearchOpen(false);
    setSearchDraft("");
    setSearchStatus("idle");
    setSectionSearch(null);
  }

  useEffect(() => {
    if (!isSearchOpen) return;

    const timer = setTimeout(() => searchInputRef.current?.focus(), 30);
    return () => clearTimeout(timer);
  }, [isSearchOpen]);

  const activeTab = TABS.find((tab) => tab.key === currentTab);

  const submitSectionSearch = async (event) => {
    event.preventDefault();

    const term = searchDraft.trim();

    if (!term) {
      setSectionSearch(null);
      setSearchStatus("idle");
      return;
    }

    setSearchStatus("searching");

    try {
      const data = await search(term, currentTab, projectId);
      setSectionSearch({ term, results: data[currentTab] ?? [] });
      setSearchStatus("done");
    } catch (searchError) {
      console.error("Section search error:", searchError);
      setSectionSearch(null);
      setSearchStatus("error");
    }
  };

  const handleSortableChange = useCallback((value) => setIsSortable(value), []);

  const [documentSort, setDocumentSort] = useLocalStorageState(
    "devnote_document_sort",
    "created",
  );
  const [documentView, setDocumentView] = useLocalStorageState(
    "devnote_document_view",
    "grid",
  );
  const [snippetSort, setSnippetSort] = useLocalStorageState(
    "devnote_snippet_sort",
    "created",
  );
  const [snippetView, setSnippetView] = useLocalStorageState(
    "devnote_snippet_view",
    "grid",
  );
  const [todoSort, setTodoSort] = useLocalStorageState(
    "devnote_todo_sort",
    "priority",
  );
  const [todoView, setTodoView] = useLocalStorageState(
    "devnote_todo_view",
    "list",
  );

  const toggleDropdown = (name) => (isOpen) =>
    setOpenDropdown(isOpen ? name : null);

  /* Sort and view live on the toolbar row of each panel, not on the tab row:
     each panel receives them as a node and drops them at its right end. */
  const sortDropdown = (id, options, sort, defaultSort, onSortChange) =>
    isSortable && (
      <ContentSortDropdown
        id={id}
        options={options}
        sort={sort}
        defaultSort={defaultSort}
        isOpen={openDropdown === id}
        onToggle={toggleDropdown(id)}
        onSortChange={onSortChange}
      />
    );

  const viewToggle = (id, value, onChange, views) => (
    <div id={id} className="todo-view-toggle">
      {views.map((view) => (
        <button
          key={view.value}
          className={`btn-view-toggle${value === view.value ? " active" : ""}`}
          data-view={view.value}
          title={view.title}
          onClick={() => onChange(view.value)}
        >
          <i className={`ph-light ${view.icon}`} />
        </button>
      ))}
    </div>
  );

  const documentControls = (
    <>
      {sortDropdown(
        "document",
        DOCUMENT_SORT_OPTIONS,
        documentSort,
        "created",
        setDocumentSort,
      )}
      {viewToggle("document-view-toggle", documentView, setDocumentView, [
        { value: "grid", title: "Icons", icon: "ph-squares-four" },
        { value: "list", title: "List", icon: "ph-list-bullets" },
      ])}
    </>
  );

  const snippetControls = (
    <>
      {sortDropdown(
        "snippet",
        SNIPPET_SORT_OPTIONS,
        snippetSort,
        "created",
        setSnippetSort,
      )}
      {viewToggle("snippet-view-toggle", snippetView, setSnippetView, [
        { value: "grid", title: "Grid view", icon: "ph-squares-four" },
        { value: "grouped", title: "By language", icon: "ph-rows" },
      ])}
    </>
  );

  const todoControls = (
    <>
      {sortDropdown(
        "todo",
        TODO_SORT_OPTIONS,
        todoSort,
        "priority",
        setTodoSort,
      )}
      {viewToggle("todo-view-toggle", todoView, setTodoView, [
        { value: "list", title: "List view", icon: "ph-list-bullets" },
        { value: "kanban", title: "Kanban view", icon: "ph-columns" },
      ])}
    </>
  );

  return (
    <>
      <div className={`tabs${isSearchOpen ? " is-searching" : ""}`}>
        <div className="tabs-breadcrumb" ref={setBreadcrumbSlot} />

        <div className={`tabs-inner${isSearchOpen ? " is-hidden" : ""}`}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              className={`tab${currentTab === tab.key ? " active" : ""}`}
              data-tab={tab.key}
              onClick={() => onTabChange(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {isSearchOpen && (
          <form className="tabs-search" onSubmit={submitSectionSearch}>
            <i className="ph-light ph-magnifying-glass tabs-search-icon" />
            <input
              ref={searchInputRef}
              type="text"
              className="tabs-search-input"
              placeholder={`Search in ${activeTab?.label ?? ""}…`}
              autoComplete="off"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") closeSectionSearch();
              }}
            />
            <span className="tabs-search-status">
              {searchStatus === "searching" && "Searching…"}
              {searchStatus === "error" && "Search failed"}
              {searchStatus === "done" &&
                `${sectionSearch?.results.length ?? 0} in project`}
              {searchStatus === "idle" && "Enter"}
            </span>
          </form>
        )}

        <div className="tabs-actions">
          <button
            type="button"
            className="btn-icon-sm tabs-search-toggle"
            title={
              isSearchOpen
                ? "Close search"
                : `Search in ${activeTab?.label ?? ""}`
            }
            aria-label={
              isSearchOpen
                ? "Close search"
                : `Search in ${activeTab?.label ?? ""}`
            }
            onClick={() =>
              isSearchOpen ? closeSectionSearch() : setIsSearchOpen(true)
            }
          >
            <i
              className={`ph-light ${isSearchOpen ? "ph-x" : "ph-magnifying-glass"}`}
            />
          </button>
        </div>
      </div>

      <div className="tab-content" ref={tabContentRef}>
        <div
          id="tab-documents"
          className={`tab-pane${currentTab === "documents" ? " active" : ""}`}
        >
          {currentTab === "documents" && (
            <DocumentsPanel
              key={projectId}
              controls={documentControls}
              projectId={projectId}
              sort={documentSort}
              view={documentView}
              scrollRef={tabContentRef}
              headerSlot={headerSlot}
              breadcrumbSlot={breadcrumbSlot}
              searchQuery={searchQuery}
              searchItemId={searchItemId}
              sectionSearchTerm={sectionSearch?.term ?? null}
              sectionSearchResults={sectionSearch?.results ?? null}
              onSectionSearchReset={closeSectionSearch}
              openTarget={openTarget?.tab === "documents" ? openTarget : null}
              contentVersion={contentVersion}
              onPinnedChanged={onPinnedChanged}
              onActiveItemChange={onActiveItemChange}
              onSortableChange={handleSortableChange}
            />
          )}
        </div>

        <div
          id="tab-snippets"
          className={`tab-pane${currentTab === "snippets" ? " active" : ""}`}
        >
          {currentTab === "snippets" && (
            <SnippetsPanel
              key={projectId}
              controls={snippetControls}
              projectId={projectId}
              sort={snippetSort}
              view={snippetView}
              scrollRef={tabContentRef}
              breadcrumbSlot={breadcrumbSlot}
              searchQuery={searchQuery}
              searchItemId={searchItemId}
              sectionSearchTerm={sectionSearch?.term ?? null}
              sectionSearchResults={sectionSearch?.results ?? null}
              onSectionSearchReset={closeSectionSearch}
              openTarget={openTarget?.tab === "snippets" ? openTarget : null}
              contentVersion={contentVersion}
              onPinnedChanged={onPinnedChanged}
              onActiveItemChange={onActiveItemChange}
              onSortableChange={handleSortableChange}
            />
          )}
        </div>

        <div
          id="tab-todos"
          className={`tab-pane${currentTab === "todos" ? " active" : ""}`}
        >
          {currentTab === "todos" && (
            <TodosPanel
              key={projectId}
              controls={todoControls}
              projectId={projectId}
              sort={todoSort}
              view={todoView}
              searchQuery={searchQuery}
              searchItemId={searchItemId}
              sectionSearchTerm={sectionSearch?.term ?? null}
              sectionSearchResults={sectionSearch?.results ?? null}
              onSectionSearchReset={closeSectionSearch}
              openTarget={openTarget?.tab === "todos" ? openTarget : null}
              contentVersion={contentVersion}
              onPinnedChanged={onPinnedChanged}
              onActiveItemChange={onActiveItemChange}
              onSortableChange={handleSortableChange}
            />
          )}
        </div>
      </div>
    </>
  );
}
