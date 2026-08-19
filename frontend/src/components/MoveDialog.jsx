import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import FolderBreadcrumb from "./FolderBreadcrumb.jsx";
import Modal from "./Modal.jsx";
import { getFolders } from "../services/folderService.js";

export default function MoveDialog({
  entry,
  projectId,
  resourceType,
  originId,
  onCancel,
  onMove,
}) {
  const [path, setPath] = useState([]);
  const [folders, setFolders] = useState([]);
  const [nextUrl, setNextUrl] = useState(null);
  const [loadedId, setLoadedId] = useState(undefined);
  const [error, setError] = useState(null);
  const [isMoving, setIsMoving] = useState(false);

  const destination = path.length ? path[path.length - 1] : null;
  const destinationId = destination?.id ?? null;
  const isLoading = loadedId !== destinationId;

  const isFolder = entry.type === "folder";
  const entryLabel = isFolder ? entry.name : entry.title;

  useEffect(() => {
    let isStale = false;

    getFolders(projectId, destinationId, null, resourceType)
      .then((data) => {
        if (isStale) return;

        setFolders(data.results ?? data);
        setNextUrl(data.next ?? null);
        setError(null);
        setLoadedId(destinationId);
      })
      .catch((loadError) => {
        if (isStale) return;

        console.error("Error loading folders:", loadError);
        setFolders([]);
        setNextUrl(null);
        setError("Unable to load folders");
        setLoadedId(destinationId);
      });

    return () => {
      isStale = true;
    };
  }, [projectId, destinationId, resourceType]);

  const loadMore = async () => {
    if (!nextUrl) return;

    try {
      const data = await getFolders(
        projectId,
        destinationId,
        nextUrl,
        resourceType,
      );
      setFolders((current) => [...current, ...(data.results ?? data)]);
      setNextUrl(data.next ?? null);
    } catch (loadMoreError) {
      console.error("Error loading more folders:", loadMoreError);
      setError("Unable to load folders");
    }
  };

  const navigateTo = (index) =>
    setPath((current) => current.slice(0, index + 1));

  const isAlreadyHere = destinationId === originId;

  const takenName =
    isFolder &&
    folders.some(
      (folder) => folder.id !== entry.id && folder.name === entry.name,
    );

  const blockedReason = isAlreadyHere
    ? `"${entryLabel}" is already here.`
    : takenName
      ? `A folder named "${entry.name}" already exists here.`
      : null;

  const handleMove = async () => {
    if (isMoving) return;

    setIsMoving(true);

    try {
      await onMove(destinationId);
    } finally {
      setIsMoving(false);
    }
  };

  return createPortal(
    <Modal isOpen title={`Move "${entryLabel}"`} onClose={onCancel}>
      <div className="move-dialog">
        <FolderBreadcrumb path={path} onNavigate={navigateTo} />

        <div className="move-dialog-list">
          {isLoading && <p className="loading">Loading...</p>}

          {!isLoading && error && <p className="error">{error}</p>}

          {!isLoading &&
            !error &&
            folders.map((folder) => {
              const isSelf = isFolder && folder.id === entry.id;

              return (
                <button
                  key={folder.id}
                  type="button"
                  className="move-dialog-row"
                  disabled={isSelf}
                  onClick={() =>
                    setPath((current) => [
                      ...current,
                      { id: folder.id, name: folder.name },
                    ])
                  }
                >
                  <i className="ph-light ph-folder" />
                  <span className="move-dialog-row-name">{folder.name}</span>
                  {isSelf ? (
                    <span className="move-dialog-row-hint">Moving</span>
                  ) : (
                    <i className="ph-light ph-caret-right" />
                  )}
                </button>
              );
            })}

          {!isLoading && !error && folders.length === 0 && (
            <p className="empty">No subfolder here</p>
          )}

          {!isLoading && !error && nextUrl && (
            <button
              type="button"
              className="move-dialog-more"
              onClick={loadMore}
            >
              Load more folders
            </button>
          )}
        </div>

        {blockedReason && <p className="move-dialog-note">{blockedReason}</p>}

        <div className="modal-actions">
          <button
            type="button"
            className="dn-dialog-btn dn-dialog-btn--cancel"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="dn-dialog-btn dn-dialog-btn--primary"
            disabled={
              isLoading || Boolean(error) || Boolean(blockedReason) || isMoving
            }
            onClick={handleMove}
          >
            {destination ? `Move to "${destination.name}"` : "Move to Root"}
          </button>
        </div>
      </div>
    </Modal>,
    document.body,
  );
}
