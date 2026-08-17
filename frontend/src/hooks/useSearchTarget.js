import { useEffect } from "react";

export function useSearchTarget(containerRef, itemId, isReady) {
  useEffect(() => {
    if (!itemId || !isReady) return;

    const target = containerRef.current?.querySelector(`[data-id="${itemId}"]`);
    if (!target) return;

    const scrollTimer = setTimeout(
      () => target.scrollIntoView({ behavior: "smooth", block: "center" }),
      100,
    );

    target.classList.add("search-target");
    const flashTimer = setTimeout(
      () => target.classList.remove("search-target"),
      2000,
    );

    return () => {
      clearTimeout(scrollTimer);
      clearTimeout(flashTimer);
      target.classList.remove("search-target");
    };
  }, [containerRef, itemId, isReady]);
}
