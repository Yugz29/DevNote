import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const VIEWPORT_MARGIN = 8;
const DROPDOWN_GAP = 6;
const SUBMENU_GAP = 5;
const SUBMENU_INSET = 5;
const HOVER_CLOSE_DELAY = 120;

export default function CardMenu({ label, items }) {
  const wrapRef = useRef(null);
  const menuTriggerRef = useRef(null);
  const dropdownNodeRef = useRef(null);
  const triggerNodeRef = useRef(null);
  const submenuNodeRef = useRef(null);
  const focusOnOpenRef = useRef(false);
  const closeTimerRef = useRef(null);

  const [isOpen, setIsOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState(null);
  const [openSubmenu, setOpenSubmenu] = useState(null);
  const [submenuPosition, setSubmenuPosition] = useState(null);

  const cancelHoverClose = useCallback(() => {
    if (closeTimerRef.current === null) return;

    clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  }, []);

  const close = useCallback(() => {
    cancelHoverClose();
    setIsOpen(false);
    setDropdownPosition(null);
    setOpenSubmenu(null);
  }, [cancelHoverClose]);

  const closeSubmenu = useCallback(() => {
    cancelHoverClose();
    setOpenSubmenu(null);
    triggerNodeRef.current?.focus();
  }, [cancelHoverClose]);

  useEffect(() => {
    if (!isOpen) return;

    const onDocumentClick = (event) => {
      const insideMenu =
        wrapRef.current?.contains(event.target) ||
        dropdownNodeRef.current?.contains(event.target) ||
        submenuNodeRef.current?.contains(event.target);

      if (!insideMenu) close();
    };

    document.addEventListener("click", onDocumentClick);
    return () => document.removeEventListener("click", onDocumentClick);
  }, [isOpen, close]);

  useEffect(() => cancelHoverClose, [cancelHoverClose]);

  const measureDropdown = useCallback(() => {
    const trigger = menuTriggerRef.current;
    const dropdown = dropdownNodeRef.current;
    if (!trigger || !dropdown) return null;

    const anchor = trigger.getBoundingClientRect();
    const { width, height } = dropdown.getBoundingClientRect();

    const left = Math.min(
      Math.max(anchor.right - width, VIEWPORT_MARGIN),
      Math.max(window.innerWidth - width - VIEWPORT_MARGIN, VIEWPORT_MARGIN),
    );

    const below = anchor.bottom + DROPDOWN_GAP;
    const fitsBelow = below + height <= window.innerHeight - VIEWPORT_MARGIN;
    const top = fitsBelow
      ? below
      : Math.max(anchor.top - height - DROPDOWN_GAP, VIEWPORT_MARGIN);

    return { top, left };
  }, []);

  const mountDropdown = useCallback(
    (node) => {
      dropdownNodeRef.current = node;
      if (!node) return;

      setDropdownPosition(measureDropdown());
    },
    [measureDropdown],
  );

  useEffect(() => {
    if (!isOpen) return;

    const reposition = () => setDropdownPosition(measureDropdown());

    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [isOpen, measureDropdown]);

  const measurePosition = useCallback(() => {
    const trigger = triggerNodeRef.current;
    const submenu = submenuNodeRef.current;
    if (!trigger || !submenu) return null;

    const anchor = trigger.getBoundingClientRect();
    const { width, height } = submenu.getBoundingClientRect();

    const onTheLeft = anchor.left - width - SUBMENU_GAP;
    const left =
      onTheLeft >= VIEWPORT_MARGIN
        ? onTheLeft
        : Math.min(
            anchor.right + SUBMENU_GAP,
            window.innerWidth - width - VIEWPORT_MARGIN,
          );

    const lowest = Math.max(
      VIEWPORT_MARGIN,
      window.innerHeight - height - VIEWPORT_MARGIN,
    );
    const top = Math.min(
      Math.max(anchor.top - SUBMENU_INSET, VIEWPORT_MARGIN),
      lowest,
    );

    return { top, left };
  }, []);

  const mountSubmenu = useCallback(
    (node) => {
      submenuNodeRef.current = node;
      if (!node) return;

      setSubmenuPosition(measurePosition());
    },
    [measurePosition],
  );

  useEffect(() => {
    if (!submenuPosition || !focusOnOpenRef.current) return;

    focusOnOpenRef.current = false;
    submenuNodeRef.current?.querySelector("button")?.focus();
  }, [submenuPosition]);

  useEffect(() => {
    if (!openSubmenu) return;

    const reposition = () => setSubmenuPosition(measurePosition());

    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [openSubmenu, measurePosition]);

  const openSubmenuFor = (item, node, shouldFocus) => {
    cancelHoverClose();
    triggerNodeRef.current = node;
    focusOnOpenRef.current = shouldFocus;
    setSubmenuPosition(null);
    setOpenSubmenu(item.label);
  };

  const scheduleHoverClose = () => {
    cancelHoverClose();
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      setOpenSubmenu(null);
    }, HOVER_CLOSE_DELAY);
  };

  const handleKeyDown = (event) => {
    if (event.key !== "Escape" || !isOpen) return;

    event.stopPropagation();
    if (openSubmenu) {
      closeSubmenu();
      return;
    }

    close();
  };

  const select = (item) => {
    close();
    item.onSelect();
  };

  const renderItem = (item) => (
    <button
      key={item.label}
      type="button"
      role="menuitem"
      className={`card-menu-item${item.isDanger ? " is-danger" : ""}`}
      onClick={() => select(item)}
    >
      <i className={`ph-light ${item.icon}`} />
      <span>{item.label}</span>
    </button>
  );

  const renderSubmenu = (item) => (
    <div
      ref={mountSubmenu}
      className="card-menu-submenu"
      role="menu"
      aria-label={item.label}
      style={{
        top: submenuPosition ? `${submenuPosition.top}px` : 0,
        left: submenuPosition ? `${submenuPosition.left}px` : 0,
        visibility: submenuPosition ? "visible" : "hidden",
      }}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") cancelHoverClose();
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") scheduleHoverClose();
      }}
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft") return;

        event.preventDefault();
        closeSubmenu();
      }}
    >
      {item.items.map(renderItem)}
    </div>
  );

  return (
    <div className="card-menu" ref={wrapRef} onKeyDown={handleKeyDown}>
      <button
        type="button"
        ref={menuTriggerRef}
        className={`card-menu-trigger${isOpen ? " open" : ""}`}
        title={label}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => (isOpen ? close() : setIsOpen(true))}
      >
        <i className="ph-light ph-dots-three" />
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={mountDropdown}
            className="card-menu-dropdown"
            role="menu"
            style={{
              top: dropdownPosition ? `${dropdownPosition.top}px` : 0,
              left: dropdownPosition ? `${dropdownPosition.left}px` : 0,
              visibility: dropdownPosition ? "visible" : "hidden",
            }}
          >
            {items.map((item) => {
              if (!item.items) return renderItem(item);

              const isSubmenuOpen = openSubmenu === item.label;

              return (
                <div
                  key={item.label}
                  role="none"
                  className="card-menu-group"
                  onPointerEnter={(event) => {
                    if (event.pointerType !== "mouse" || isSubmenuOpen) return;

                    openSubmenuFor(item, event.currentTarget.firstChild, false);
                  }}
                  onPointerLeave={(event) => {
                    if (event.pointerType === "mouse" && isSubmenuOpen) {
                      scheduleHoverClose();
                    }
                  }}
                >
                  <button
                    type="button"
                    role="menuitem"
                    className={`card-menu-item${isSubmenuOpen ? " is-open" : ""}`}
                    aria-haspopup="menu"
                    aria-expanded={isSubmenuOpen}
                    onClick={(event) =>
                      isSubmenuOpen
                        ? closeSubmenu()
                        : openSubmenuFor(
                            item,
                            event.currentTarget,
                            event.detail === 0,
                          )
                    }
                    onKeyDown={(event) => {
                      if (event.key !== "ArrowRight") return;

                      event.preventDefault();
                      openSubmenuFor(item, event.currentTarget, true);
                    }}
                  >
                    <i className={`ph-light ${item.icon}`} />
                    <span>{item.label}</span>
                    <i className="ph-light ph-caret-right card-menu-caret" />
                  </button>

                  {isSubmenuOpen &&
                    createPortal(renderSubmenu(item), document.body)}
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}
