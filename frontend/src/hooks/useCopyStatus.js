import { useEffect, useRef, useState } from "react";

const RESET_DELAY = 1500;

export function useCopyStatus() {
  const [status, setStatus] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const copy = async (text) => {
    let next = "copied";

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      next = "failed";
    }

    setStatus(next);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setStatus(null), RESET_DELAY);
  };

  return { status, copy };
}
