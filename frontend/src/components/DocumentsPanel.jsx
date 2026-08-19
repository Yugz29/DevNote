import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import DocumentBlock from "./DocumentBlock.jsx";
import DocumentCard from "./DocumentCard.jsx";
import DocumentPrintView from "./DocumentPrintView.jsx";
import FolderBreadcrumb from "./FolderBreadcrumb.jsx";
import FolderCard from "./FolderCard.jsx";
import MoveDialog from "./MoveDialog.jsx";
import { useDialog } from "../contexts/DialogContext.js";
import { useTheme } from "../contexts/ThemeContext.js";
import { useResourceList } from "../hooks/useResourceList.js";
import { useSearchTarget } from "../hooks/useSearchTarget.js";
import { applyMermaidTheme } from "../lib/blocknote.js";
import { downloadTextFile, toFilename } from "../lib/download.js";
import {
  EMPTY_LOCATION,
  readLocation,
  writeLocation,
} from "../lib/documentsLocation.js";
import {
  createDocument,
  deleteDocument,
  duplicateDocument,
  getDocument,
  moveDocument,
  setDocumentPinned,
  updateDocument,
} from "../services/documentService.js";
import {
  createFolder,
  deleteFolder,
  getLevelContents,
  updateFolder,
} from "../services/folderService.js";

const SCROLL_SAVE_DELAY = 150;
const RESTORE_SCROLL_FRAMES = 30;

function sortEntries(entries, sort) {
  const folders = entries.filter((entry) => entry.type === "folder");
  const docs = entries.filter((entry) => entry.type !== "folder");

  folders.sort((a, b) => a.name.localeCompare(b.name));

  docs.sort((a, b) => {
    if (sort === "updated") {
      return new Date(b.updated_at) - new Date(a.updated_at);
    }
    if (sort === "title") {
      return a.title.localeCompare(b.title);
    }
    return new Date(b.created_at) - new Date(a.created_at);
  });

  return [...folders, ...docs];
}

export default function DocumentsPanel({
  projectId,
  sort,
  scrollRef,
  headerSlot,
  breadcrumbSlot,
  searchQuery,
  searchItemId,
  openTarget,
  contentVersion,
  onPinnedChanged,
  onActiveItemChange,
  onSortableChange,
}) {
  const { showAlert, showConfirm } = useDialog();
  const { theme } = useTheme();
  const containerRef = useRef(null);
  const detailRef = useRef(null);
  const printKeyRef = useRef(0);
  const themeRef = useRef(theme);
  const versionRef = useRef(contentVersion);

  const [initialLocation] = useState(() =>
    searchItemId ? EMPTY_LOCATION : readLocation(projectId),
  );
  const scrollTopRef = useRef(initialLocation.scrollTop);
  const restoreScrollRef = useRef(
    initialLocation.documentId ? initialLocation.scrollTop : 0,
  );
  const [path, setPath] = useState(initialLocation.path);
  const [openDocument, setOpenDocument] = useState(null);
  const [pendingDocumentId, setPendingDocumentId] = useState(
    initialLocation.documentId,
  );
  const [unreachableFolderId, setUnreachableFolderId] = useState(null);
  const [isCreatingDocument, setIsCreatingDocument] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [renamingFolderId, setRenamingFolderId] = useState(null);
  const [movingEntry, setMovingEntry] = useState(null);
  const [printTarget, setPrintTarget] = useState(null);

  const [openRequest, setOpenRequest] = useState(null);

  if (openTarget !== openRequest) {
    setOpenRequest(openTarget);

    if (openTarget) {
      setIsCreatingDocument(false);
      setPendingDocumentId(openTarget.itemId);
    }
  }

  const currentFolder = path.length ? path[path.length - 1] : null;
  const currentFolderId = currentFolder?.id ?? null;
  const locatedDocumentId = openDocument?.id ?? pendingDocumentId;

  const fetchContents = useMemo(
    () => (id, url) => getLevelContents(projectId, currentFolderId, url),
    [projectId, currentFolderId],
  );

  const { items, isLoading, error, reload, setItems } = useResourceList({
    projectId,
    fetchPage: fetchContents,
    scrollRef,
    resetKey: currentFolderId,
  });

  const restoredFolderId = initialLocation.path.at(-1)?.id ?? null;

  if (
    error &&
    currentFolderId &&
    currentFolderId === restoredFolderId &&
    unreachableFolderId !== currentFolderId
  ) {
    setUnreachableFolderId(currentFolderId);
    setPath([]);
  }

  const entries = useMemo(() => sortEntries(items, sort), [items, sort]);

  useSearchTarget(containerRef, searchItemId, !isLoading && entries.length > 0);

  useEffect(() => {
    themeRef.current = theme;
  });

  useEffect(() => {
    if (!pendingDocumentId) return;

    let isStale = false;

    getDocument(pendingDocumentId)
      .then((doc) => {
        if (isStale) return;
        setOpenDocument(doc);
        setPendingDocumentId(null);
      })
      .catch(() => {
        if (!isStale) setPendingDocumentId(null);
      });

    return () => {
      isStale = true;
    };
  }, [pendingDocumentId]);

  useEffect(() => {
    onActiveItemChange(openDocument?.id ?? null);

    return () => onActiveItemChange(null);
  }, [openDocument, onActiveItemChange]);

  useEffect(() => {
    if (versionRef.current === contentVersion) return;

    versionRef.current = contentVersion;
    reload();
  }, [contentVersion, reload]);

  useEffect(() => {
    writeLocation(projectId, {
      path,
      documentId: locatedDocumentId,
      scrollTop: scrollTopRef.current,
    });
  }, [projectId, path, locatedDocumentId]);

  const flushDetail = async () => {
    await detailRef.current?.flush();
  };

  const openDocumentCard = async (card) => {
    try {
      setOpenDocument(await getDocument(card.id));
    } catch (openError) {
      console.error("Error opening document:", openError);
      await showAlert("Unable to open the document");
    }
  };

  const leaveDetail = async () => {
    await flushDetail();
    setOpenDocument(null);
    setIsCreatingDocument(false);
    await reload();
    onPinnedChanged();
  };

  const openFolder = async (folder) => {
    await leaveDetail();
    setIsCreatingFolder(false);
    setRenamingFolderId(null);
    setPath((current) => [...current, { id: folder.id, name: folder.name }]);
  };

  const navigateTo = async (index) => {
    await leaveDetail();
    setIsCreatingFolder(false);
    setRenamingFolderId(null);
    setPath((current) => current.slice(0, index + 1));
  };

  const handleCreateFolder = async (name) => {
    const trimmed = name.trim();
    setIsCreatingFolder(false);

    if (!trimmed) return;

    try {
      const created = await createFolder(projectId, trimmed, currentFolderId);
      setItems((current) => [{ type: "folder", ...created }, ...current]);
    } catch (createError) {
      console.error("Error creating folder:", createError);
      await showAlert(
        createError.response?.data?.name?.[0] ?? "Unable to create the folder",
      );
    }
  };

  const handleRenameFolder = async (folder, name) => {
    setRenamingFolderId(null);

    try {
      const updated = await updateFolder(folder.id, { name });
      setItems((current) =>
        current.map((entry) =>
          entry.type === "folder" && entry.id === folder.id
            ? { ...entry, ...updated }
            : entry,
        ),
      );
    } catch (renameError) {
      console.error("Error renaming folder:", renameError);
      await showAlert(
        renameError.response?.data?.name?.[0] ?? "Unable to rename the folder",
      );
    }
  };

  const dropEntry = (id) =>
    setItems((current) => current.filter((entry) => entry.id !== id));

  const handleMove = async (destinationId) => {
    const entry = movingEntry;
    const isFolder = entry.type === "folder";

    try {
      if (isFolder) {
        await updateFolder(entry.id, { parent: destinationId });
      } else {
        await moveDocument(entry.id, destinationId);
      }
    } catch (moveError) {
      console.error("Error moving entry:", moveError);

      const data = moveError.response?.data;
      const reason = data?.parent?.[0] ?? data?.folder?.[0] ?? data?.name?.[0];

      await showAlert(
        reason ?? `Unable to move the ${isFolder ? "folder" : "document"}`,
      );
      return;
    }

    setMovingEntry(null);
    setItems((current) =>
      current
        .filter((item) => item.id !== entry.id)
        .map((item) =>
          item.type === "folder" && item.id === destinationId
            ? {
                ...item,
                folder_count: item.folder_count + (isFolder ? 1 : 0),
                document_count: item.document_count + (isFolder ? 0 : 1),
              }
            : item,
        ),
    );
  };

  const handleDeleteFolder = async (folder) => {
    try {
      await deleteFolder(folder.id);
      dropEntry(folder.id);
      onPinnedChanged();
      return;
    } catch (deleteError) {
      const data = deleteError.response?.data;

      if (deleteError.response?.status !== 409 || !data) {
        console.error("Error deleting folder:", deleteError);
        await showAlert("Unable to delete the folder");
        return;
      }

      const parts = [];
      if (data.folders) {
        parts.push(`${data.folders} subfolder${data.folders > 1 ? "s" : ""}`);
      }
      if (data.documents) {
        parts.push(
          `${data.documents} document${data.documents > 1 ? "s" : ""}`,
        );
      }

      const confirmed = await showConfirm(
        `"${folder.name}" is not empty. Deleting it will also delete ${parts.join(" and ")}. This cannot be undone.`,
        "Delete everything",
      );

      if (!confirmed) return;

      try {
        await deleteFolder(folder.id, { confirm: true });
        dropEntry(folder.id);
        onPinnedChanged();
      } catch (forcedError) {
        console.error("Error deleting folder:", forcedError);
        await showAlert("Unable to delete the folder");
      }
    }
  };

  const handleSave = async (documentId, title, content) => {
    const trimmedTitle = title.trim();

    if (!trimmedTitle) {
      await showAlert("Title is required", "info");
      return false;
    }

    try {
      if (documentId) {
        const updated = await updateDocument(documentId, trimmedTitle, content);
        setOpenDocument((current) =>
          current && current.id === documentId
            ? { ...current, ...updated }
            : current,
        );
      } else {
        await createDocument(projectId, trimmedTitle, content, currentFolderId);
      }

      return true;
    } catch (saveError) {
      console.error("Error saving document:", saveError);
      await showAlert("Unable to save the document");
      return false;
    }
  };

  const handleTogglePin = async (doc) => {
    const nextPinned = !doc.is_pinned;

    try {
      await setDocumentPinned(doc.id, nextPinned);
    } catch (pinError) {
      console.error("Error pinning document:", pinError);
      await showAlert(`Unable to ${nextPinned ? "pin" : "unpin"} the document`);
      return;
    }

    setItems((current) =>
      current.map((entry) =>
        entry.type !== "folder" && entry.id === doc.id
          ? { ...entry, is_pinned: nextPinned }
          : entry,
      ),
    );

    onPinnedChanged();
  };

  const exportMarkdown = (title, content) => {
    downloadTextFile(toFilename(title, "md"), content ?? "", "text/markdown");
  };

  const exportPdf = (title, content) => {
    applyMermaidTheme("light");
    printKeyRef.current += 1;
    setPrintTarget({ key: printKeyRef.current, title, content });
  };

  const closePrint = useCallback(() => {
    applyMermaidTheme(themeRef.current);
    setPrintTarget(null);
  }, []);

  const withDocumentContent = async (doc, action) => {
    try {
      const full = await getDocument(doc.id);
      action(full.title, full.content);
    } catch (exportError) {
      console.error("Error exporting document:", exportError);
      await showAlert("Unable to export the document");
    }
  };

  const handleExportMarkdown = (doc) =>
    withDocumentContent(doc, exportMarkdown);

  const handleExportPdf = (doc) => withDocumentContent(doc, exportPdf);

  const handleDuplicateDocument = async (doc) => {
    try {
      await duplicateDocument(doc.id);
      await reload();
    } catch (duplicateError) {
      console.error("Error duplicating document:", duplicateError);
      await showAlert("Unable to duplicate the document");
    }
  };

  const handleDeleteDocument = async (doc) => {
    const confirmed = await showConfirm(`Delete "${doc.title}"?`);
    if (!confirmed) return;

    try {
      await deleteDocument(doc.id);
      dropEntry(doc.id);
      if (openDocument?.id === doc.id) setOpenDocument(null);
      onPinnedChanged();
    } catch (deleteError) {
      console.error("Error deleting document:", deleteError);
      await showAlert("Unable to delete the document");
    }
  };

  const detailDocument = isCreatingDocument ? null : openDocument;
  const isDetail = isCreatingDocument || Boolean(openDocument);

  useEffect(() => {
    const target = restoreScrollRef.current;
    const container = scrollRef?.current;

    if (!isDetail || !target || !container) return;

    restoreScrollRef.current = 0;

    let frame = 0;
    let remaining = RESTORE_SCROLL_FRAMES;

    const apply = () => {
      container.scrollTop = target;
      remaining -= 1;

      const maxScroll = container.scrollHeight - container.clientHeight;

      if (maxScroll < target && remaining > 0) {
        frame = requestAnimationFrame(apply);
      }
    };

    frame = requestAnimationFrame(apply);

    return () => cancelAnimationFrame(frame);
  }, [isDetail, scrollRef]);

  useEffect(() => {
    const container = scrollRef?.current;

    if (!locatedDocumentId) {
      scrollTopRef.current = 0;
      return;
    }

    if (!isDetail || !container) return;

    let timer = null;

    const persist = () => {
      timer = null;
      writeLocation(projectId, {
        path,
        documentId: locatedDocumentId,
        scrollTop: scrollTopRef.current,
      });
    };

    const onScroll = () => {
      scrollTopRef.current = container.scrollTop;

      if (!timer) timer = setTimeout(persist, SCROLL_SAVE_DELAY);
    };

    container.addEventListener("scroll", onScroll);

    return () => {
      container.removeEventListener("scroll", onScroll);

      if (timer) {
        clearTimeout(timer);
        persist();
      }
    };
  }, [isDetail, locatedDocumentId, path, projectId, scrollRef]);

  const isSortable = !isDetail && !isLoading && !error && entries.length > 1;

  useEffect(() => {
    onSortableChange(isSortable);
  }, [onSortableChange, isSortable]);

  return (
    <div id="documents-list" className="documents-list" ref={containerRef}>
      {breadcrumbSlot &&
        createPortal(
          <FolderBreadcrumb
            path={path}
            isDetail={isDetail}
            onNavigate={navigateTo}
          />,
          breadcrumbSlot,
        )}

      {isDetail ? (
        <DocumentBlock
          key={openDocument?.id ?? "new"}
          ref={detailRef}
          doc={detailDocument}
          searchQuery={searchQuery}
          onSave={handleSave}
          onDiscard={leaveDetail}
          onDelete={() =>
            detailDocument && handleDeleteDocument(detailDocument)
          }
          onExportMarkdown={exportMarkdown}
          onExportPdf={exportPdf}
          scrollRef={scrollRef}
          headerSlot={headerSlot}
        />
      ) : (
        <>
          <div className="gallery-toolbar">
            <button
              type="button"
              className="gallery-action"
              onClick={() => setIsCreatingFolder(true)}
            >
              <i className="ph-light ph-folder-plus" />
              <span>New folder</span>
            </button>
            <button
              type="button"
              className="gallery-action"
              onClick={() => setIsCreatingDocument(true)}
            >
              <i className="ph-light ph-plus" />
              <span>New document</span>
            </button>
          </div>

          {isLoading && <p className="loading">Loading...</p>}

          {!isLoading && error && <p className="error">{error}</p>}

          {!isLoading && !error && (
            <div className="gallery-grid">
              {isCreatingFolder && (
                <FolderCard
                  folder={{ id: "new", name: "" }}
                  searchQuery={null}
                  isRenaming
                  onOpen={() => {}}
                  onStartRename={() => {}}
                  onRename={(_, name) => handleCreateFolder(name)}
                  onCancelRename={() => setIsCreatingFolder(false)}
                  onMove={() => {}}
                  onDelete={() => {}}
                />
              )}

              {entries.map((entry) =>
                entry.type === "folder" ? (
                  <FolderCard
                    key={`folder:${entry.id}:${entry.name}`}
                    folder={entry}
                    searchQuery={searchQuery}
                    isRenaming={renamingFolderId === entry.id}
                    onOpen={openFolder}
                    onStartRename={setRenamingFolderId}
                    onRename={handleRenameFolder}
                    onCancelRename={() => setRenamingFolderId(null)}
                    onMove={setMovingEntry}
                    onDelete={handleDeleteFolder}
                  />
                ) : (
                  <DocumentCard
                    key={`document:${entry.id}`}
                    doc={entry}
                    searchQuery={searchQuery}
                    onOpen={openDocumentCard}
                    onTogglePin={handleTogglePin}
                    onDuplicate={handleDuplicateDocument}
                    onExportMarkdown={handleExportMarkdown}
                    onExportPdf={handleExportPdf}
                    onMove={setMovingEntry}
                    onDelete={handleDeleteDocument}
                  />
                ),
              )}

              {entries.length === 0 && !isCreatingFolder && (
                <p className="empty">This folder is empty</p>
              )}
            </div>
          )}
        </>
      )}

      {printTarget && (
        <DocumentPrintView
          key={printTarget.key}
          title={printTarget.title}
          content={printTarget.content}
          onDone={closePrint}
        />
      )}

      {movingEntry && (
        <MoveDialog
          entry={movingEntry}
          projectId={projectId}
          originId={currentFolderId}
          onCancel={() => setMovingEntry(null)}
          onMove={handleMove}
        />
      )}
    </div>
  );
}
