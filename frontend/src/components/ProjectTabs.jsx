import { useCallback, useRef, useState } from "react";
import ContentSortDropdown from "./ContentSortDropdown.jsx";
import DocumentsPanel from "./DocumentsPanel.jsx";
import SnippetsPanel from "./SnippetsPanel.jsx";
import TodosPanel from "./TodosPanel.jsx";
import { useLocalStorageState } from "../hooks/useLocalStorageState.js";

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
  const [openDropdown, setOpenDropdown] = useState(null);
  const [isSortable, setIsSortable] = useState(false);
  const [breadcrumbSlot, setBreadcrumbSlot] = useState(null);
  const [sortableTab, setSortableTab] = useState(currentTab);

  if (sortableTab !== currentTab) {
    setSortableTab(currentTab);
    setIsSortable(false);
  }

  const handleSortableChange = useCallback((value) => setIsSortable(value), []);

  const [documentSort, setDocumentSort] = useLocalStorageState(
    "devnote_document_sort",
    "created",
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

  return (
    <>
      <div className="tabs">
        <div className="tabs-breadcrumb" ref={setBreadcrumbSlot} />

        <div className="tabs-inner">
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

        <div
          className={`document-controls${currentTab === "documents" ? " visible" : ""}`}
        >
          {isSortable && (
            <ContentSortDropdown
              id="document"
              options={DOCUMENT_SORT_OPTIONS}
              sort={documentSort}
              defaultSort="created"
              isOpen={openDropdown === "document"}
              onToggle={toggleDropdown("document")}
              onSortChange={setDocumentSort}
            />
          )}
        </div>

        <div
          className={`snippet-controls${currentTab === "snippets" ? " visible" : ""}`}
        >
          {isSortable && (
            <ContentSortDropdown
              id="snippet"
              options={SNIPPET_SORT_OPTIONS}
              sort={snippetSort}
              defaultSort="created"
              isOpen={openDropdown === "snippet"}
              onToggle={toggleDropdown("snippet")}
              onSortChange={setSnippetSort}
            />
          )}

          <div id="snippet-view-toggle" className="todo-view-toggle">
            <button
              className={`btn-view-toggle${snippetView === "grid" ? " active" : ""}`}
              data-view="grid"
              title="Grid view"
              onClick={() => setSnippetView("grid")}
            >
              <i className="ph-light ph-squares-four" />
            </button>
            <button
              className={`btn-view-toggle${snippetView === "grouped" ? " active" : ""}`}
              data-view="grouped"
              title="By language"
              onClick={() => setSnippetView("grouped")}
            >
              <i className="ph-light ph-rows" />
            </button>
          </div>
        </div>

        <div
          className={`todo-controls${currentTab === "todos" ? " visible" : ""}`}
        >
          {isSortable && (
            <ContentSortDropdown
              id="todo"
              options={TODO_SORT_OPTIONS}
              sort={todoSort}
              defaultSort="priority"
              isOpen={openDropdown === "todo"}
              onToggle={toggleDropdown("todo")}
              onSortChange={setTodoSort}
            />
          )}

          <div id="todo-view-toggle" className="todo-view-toggle">
            <button
              className={`btn-view-toggle${todoView === "list" ? " active" : ""}`}
              data-view="list"
              title="List view"
              onClick={() => setTodoView("list")}
            >
              <i className="ph-light ph-list-bullets" />
            </button>
            <button
              className={`btn-view-toggle${todoView === "kanban" ? " active" : ""}`}
              data-view="kanban"
              title="Kanban view"
              onClick={() => setTodoView("kanban")}
            >
              <i className="ph-light ph-columns" />
            </button>
          </div>
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
              projectId={projectId}
              sort={documentSort}
              scrollRef={tabContentRef}
              headerSlot={headerSlot}
              breadcrumbSlot={breadcrumbSlot}
              searchQuery={searchQuery}
              searchItemId={searchItemId}
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
              projectId={projectId}
              sort={snippetSort}
              view={snippetView}
              scrollRef={tabContentRef}
              searchQuery={searchQuery}
              searchItemId={searchItemId}
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
              projectId={projectId}
              sort={todoSort}
              view={todoView}
              searchQuery={searchQuery}
              searchItemId={searchItemId}
              onSortableChange={handleSortableChange}
            />
          )}
        </div>
      </div>
    </>
  );
}
