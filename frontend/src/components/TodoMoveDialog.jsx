import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import DnSelect from "./DnSelect.jsx";
import Modal from "./Modal.jsx";
import { getAllProjects } from "../services/projectService.js";
import { getTodoLists } from "../services/todoListService.js";

export default function TodoMoveDialog({
  todo,
  projectId,
  lists,
  onCancel,
  onMove,
}) {
  const originId = todo.list ?? null;

  const [projects, setProjects] = useState([]);
  const [destinationProjectId, setDestinationProjectId] = useState(projectId);
  const [foreignLists, setForeignLists] = useState(null);
  const [destinationId, setDestinationId] = useState(originId);
  const [isMoving, setIsMoving] = useState(false);

  const isSameProject = destinationProjectId === projectId;

  useEffect(() => {
    let isStale = false;

    getAllProjects()
      .then((all) => {
        if (!isStale) setProjects(all);
      })
      .catch((loadError) => {
        console.error("Error loading projects:", loadError);
        if (!isStale) setProjects([]);
      });

    return () => {
      isStale = true;
    };
  }, []);

  useEffect(() => {
    if (destinationProjectId === projectId) return;

    let isStale = false;

    getTodoLists(destinationProjectId)
      .then((data) => {
        if (isStale) return;

        setForeignLists({
          projectId: destinationProjectId,
          items: data.results ?? data,
        });
      })
      .catch((loadError) => {
        console.error("Error loading lists:", loadError);
        if (!isStale) {
          setForeignLists({ projectId: destinationProjectId, items: [] });
        }
      });

    return () => {
      isStale = true;
    };
  }, [destinationProjectId, projectId]);

  const destinationLists = isSameProject
    ? lists
    : foreignLists?.projectId === destinationProjectId
      ? foreignLists.items
      : null;

  const isLoading = destinationLists === null;

  const destinations = [
    { id: null, name: "Unclassified", icon: "ph-tray" },
    ...(destinationLists ?? []).map((list) => ({
      id: list.id,
      name: list.name,
      icon: "ph-list-checks",
    })),
  ];

  const destination =
    destinations.find((entry) => entry.id === destinationId) ?? destinations[0];

  const isAlreadyHere = isSameProject && destinationId === originId;

  const projectOptions = projects.map((project) => ({
    value: project.id,
    label: project.title,
  }));

  const changeProject = (nextProjectId) => {
    if (nextProjectId === destinationProjectId) return;

    setDestinationProjectId(nextProjectId);
    setDestinationId(nextProjectId === projectId ? originId : null);
  };

  const handleMove = async () => {
    if (isMoving) return;

    setIsMoving(true);

    try {
      await onMove({ project: destinationProjectId, list: destinationId });
    } finally {
      setIsMoving(false);
    }
  };

  return createPortal(
    <Modal isOpen title={`Move "${todo.title}"`} onClose={onCancel}>
      <div className="move-dialog">
        <div className="move-dialog-project">
          <span className="move-dialog-project-label">Project</span>

          {projectOptions.length > 0 ? (
            <DnSelect
              value={destinationProjectId}
              options={projectOptions}
              onChange={changeProject}
              usePortal
              label="Destination project"
              triggerClassName="move-dialog-project-select"
            />
          ) : (
            <span className="move-dialog-project-loading">
              Loading projects...
            </span>
          )}
        </div>

        <div className="move-dialog-list">
          {isLoading && <p className="loading">Loading...</p>}

          {!isLoading &&
            destinations.map((entry) => (
              <button
                key={entry.id ?? "unclassified"}
                type="button"
                className={`move-dialog-row${entry.id === destinationId ? " is-selected" : ""}`}
                aria-pressed={entry.id === destinationId}
                onClick={() => setDestinationId(entry.id)}
              >
                <i className={`ph-light ${entry.icon}`} />
                <span className="move-dialog-row-name">{entry.name}</span>
                {isSameProject && entry.id === originId && (
                  <span className="move-dialog-row-hint">Current</span>
                )}
              </button>
            ))}
        </div>

        {isAlreadyHere && (
          <p className="move-dialog-note">
            &quot;{todo.title}&quot; is already in {destination.name}.
          </p>
        )}

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
            disabled={isAlreadyHere || isLoading || isMoving}
            onClick={handleMove}
          >
            Move to &quot;{destination.name}&quot;
          </button>
        </div>
      </div>
    </Modal>,
    document.body,
  );
}
