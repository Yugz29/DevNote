import { useEffect } from "react";

export function useClickOutside(ref, onOutsideClick, isEnabled = true) {
  useEffect(() => {
    if (!isEnabled) return;

    const onDocumentClick = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        onOutsideClick();
      }
    };

    document.addEventListener("click", onDocumentClick);
    return () => document.removeEventListener("click", onDocumentClick);
  }, [ref, onOutsideClick, isEnabled]);
}
