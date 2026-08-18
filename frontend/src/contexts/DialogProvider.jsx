import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DialogContext } from "./DialogContext.js";

export default function DialogProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const [isActive, setIsActive] = useState(false);
  const resolveRef = useRef(null);

  useEffect(() => {
    if (!dialog) return;

    const frame = requestAnimationFrame(() => setIsActive(true));
    return () => cancelAnimationFrame(frame);
  }, [dialog]);

  const close = useCallback((result) => {
    setIsActive(false);
    resolveRef.current?.(result);
    resolveRef.current = null;
  }, []);

  useEffect(() => {
    if (!dialog) return;

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        close(dialog.type === "confirm" ? false : undefined);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [dialog, close]);

  const showAlert = useCallback((message, type = "error") => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setDialog({ kind: "alert", message, type });
    });
  }, []);

  const showConfirm = useCallback((message, confirmLabel = "Delete") => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setDialog({ kind: "confirm", message, confirmLabel });
    });
  }, []);

  const value = useMemo(
    () => ({ showAlert, showConfirm }),
    [showAlert, showConfirm],
  );

  return (
    <DialogContext.Provider value={value}>
      {children}
      {dialog && (
        <div
          className={`dn-dialog-overlay${isActive ? " active" : ""}`}
          onClick={(event) => {
            if (
              dialog.kind === "confirm" &&
              event.target === event.currentTarget
            ) {
              close(false);
            }
          }}
          onTransitionEnd={() => {
            if (!isActive) setDialog(null);
          }}
        >
          <div className="dn-dialog">
            {dialog.kind === "alert" ? (
              <div className={`dn-dialog-icon dn-dialog-icon--${dialog.type}`}>
                <i
                  className={
                    dialog.type === "error"
                      ? "ph-light ph-warning"
                      : "ph-light ph-info"
                  }
                />
              </div>
            ) : (
              <div className="dn-dialog-icon dn-dialog-icon--warning">
                <i className="ph-light ph-trash" />
              </div>
            )}

            <p className="dn-dialog-message">{dialog.message}</p>

            <div className="dn-dialog-actions">
              {dialog.kind === "alert" ? (
                <button
                  className="dn-dialog-btn dn-dialog-btn--primary"
                  onClick={() => close(undefined)}
                >
                  OK
                </button>
              ) : (
                <>
                  <button
                    className="dn-dialog-btn dn-dialog-btn--cancel"
                    onClick={() => close(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="dn-dialog-btn dn-dialog-btn--danger"
                    onClick={() => close(true)}
                  >
                    {dialog.confirmLabel}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}
