import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export default function DnSelect({
  value,
  options,
  onChange,
  usePortal,
  label,
  triggerClassName = "",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState(null);

  const wrapRef = useRef(null);
  const buttonRef = useRef(null);
  const dropdownRef = useRef(null);

  const updatePosition = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    setPosition({
      top: rect.bottom + 4,
      left: rect.left,
      minWidth: Math.max(130, rect.width),
    });
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const onDocumentClick = (event) => {
      if (wrapRef.current?.contains(event.target)) return;
      if (dropdownRef.current?.contains(event.target)) return;
      setIsOpen(false);
    };

    document.addEventListener("click", onDocumentClick);
    return () => document.removeEventListener("click", onDocumentClick);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !usePortal) return;

    const onScroll = () => updatePosition();
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [isOpen, usePortal, updatePosition]);

  const close = useCallback(() => {
    setIsOpen(false);
    buttonRef.current?.focus();
  }, []);

  const handleKeyDown = (event) => {
    if (event.key !== "Escape" || !isOpen) return;

    event.stopPropagation();
    close();
  };

  const selectedOption = options.find((option) => option.value === value);
  const isPortalOpen = Boolean(usePortal && isOpen && position);

  const dropdown = (
    <div
      ref={dropdownRef}
      role="listbox"
      aria-label={label}
      onKeyDown={handleKeyDown}
      className={`dn-select-dropdown${isOpen ? " open" : ""}`}
      style={
        isPortalOpen
          ? {
              position: "fixed",
              top: `${position.top}px`,
              left: `${position.left}px`,
              minWidth: `${position.minWidth}px`,
            }
          : undefined
      }
    >
      {options.map((option) => (
        <button
          key={option.value}
          className={`dn-select-option ${option.value === value ? "active" : ""}`}
          data-value={option.value}
          type="button"
          role="option"
          aria-selected={option.value === value}
          onClick={() => {
            onChange(option.value);
            close();
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="dn-select-wrap" ref={wrapRef} onKeyDown={handleKeyDown}>
      <button
        className={`dn-select-btn${triggerClassName ? ` ${triggerClassName}` : ""}`}
        type="button"
        ref={buttonRef}
        title={label}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => {
          if (!isOpen && usePortal) updatePosition();
          setIsOpen((current) => !current);
        }}
      >
        <span className="dn-select-value">
          {selectedOption ? selectedOption.label : value}
        </span>
        <i
          className="ph-light ph-caret-down dn-select-chevron"
          style={{ transform: isOpen ? "rotate(180deg)" : "" }}
        />
      </button>

      {isPortalOpen ? createPortal(dropdown, document.body) : dropdown}
    </div>
  );
}
