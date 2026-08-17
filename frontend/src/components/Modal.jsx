import { useEffect } from "react";

export default function Modal({
  isOpen,
  title,
  onClose,
  closeIcon = <i className="ph-light ph-x" />,
  children,
}) {
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  return (
    <div
      className={`modal${isOpen ? " active" : ""}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal-content">
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" title="Close" onClick={onClose}>
            {closeIcon}
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
