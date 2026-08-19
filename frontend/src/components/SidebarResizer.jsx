import { useRef } from "react";

import {
  SIDEBAR_WIDTH_DEFAULT,
  SIDEBAR_WIDTH_MAX,
  SIDEBAR_WIDTH_MIN,
  clampWidth,
} from "../lib/sidebarWidth.js";

const KEYBOARD_STEP = 16;

export default function SidebarResizer({ width, onWidthChange }) {
  const layoutRef = useRef(null);
  const liveWidthRef = useRef(width);

  /* The width is written straight to the CSS variable while dragging: one
     React render per pointermove would lag behind the cursor, and the .sidebar
     width transition has to be suspended for the same reason. */
  const paint = (next) => {
    liveWidthRef.current = next;
    layoutRef.current?.style.setProperty("--sidebar-width", `${next}px`);
  };

  const handlePointerDown = (event) => {
    if (event.button !== 0) return;

    const layout = event.currentTarget.closest(".layout");
    if (!layout) return;

    layoutRef.current = layout;
    layout.classList.add("is-resizing");
    event.currentTarget.setPointerCapture(event.pointerId);

    const startX = event.clientX;
    const startWidth = width;

    const onMove = (moveEvent) => {
      paint(clampWidth(startWidth + moveEvent.clientX - startX));
    };

    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      layout.classList.remove("is-resizing");
      onWidthChange(liveWidthRef.current);
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  };

  const handleKeyDown = (event) => {
    const step =
      event.key === "ArrowLeft"
        ? -KEYBOARD_STEP
        : event.key === "ArrowRight"
          ? KEYBOARD_STEP
          : 0;

    if (step === 0 && event.key !== "Home") return;

    event.preventDefault();
    onWidthChange(
      event.key === "Home" ? SIDEBAR_WIDTH_DEFAULT : clampWidth(width + step),
    );
  };

  return (
    <div
      className="sidebar-resizer"
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      aria-label="Sidebar width"
      aria-valuenow={width}
      aria-valuemin={SIDEBAR_WIDTH_MIN}
      aria-valuemax={SIDEBAR_WIDTH_MAX}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
      onDoubleClick={() => onWidthChange(SIDEBAR_WIDTH_DEFAULT)}
    />
  );
}
