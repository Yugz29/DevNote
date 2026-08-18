import { useState } from "react";
import { createPortal } from "react-dom";
import Modal from "./Modal.jsx";

export default function TodoMoveDialog({ todo, lists, onCancel, onMove }) {
  const originId = todo.list ?? null;
  const [destinationId, setDestinationId] = useState(originId);
  const [isMoving, setIsMoving] = useState(false);

  const destinations = [
    { id: null, name: "Unclassified", icon: "ph-tray" },
    ...lists.map((list) => ({
      id: list.id,
      name: list.name,
      icon: list.is_permanent ? "ph-star" : "ph-list-checks",
    })),
  ];

  const destination = destinations.find((entry) => entry.id === destinationId);
  const isAlreadyHere = destinationId === originId;

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
    <Modal isOpen title={`Move "${todo.title}"`} onClose={onCancel}>
      <div className="move-dialog">
        <div className="move-dialog-list">
          {destinations.map((entry) => (
            <button
              key={entry.id ?? "unclassified"}
              type="button"
              className={`move-dialog-row${entry.id === destinationId ? " is-selected" : ""}`}
              aria-pressed={entry.id === destinationId}
              onClick={() => setDestinationId(entry.id)}
            >
              <i className={`ph-light ${entry.icon}`} />
              <span className="move-dialog-row-name">{entry.name}</span>
              {entry.id === originId && (
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
            disabled={isAlreadyHere || isMoving}
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
