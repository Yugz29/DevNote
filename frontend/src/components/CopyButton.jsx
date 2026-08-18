import { useEffect, useRef, useState } from "react";

const RESET_DELAY = 1500;

const STATES = {
  copied: { icon: "ph-check", title: "Copied" },
  failed: { icon: "ph-warning", title: "Copy failed" },
};

export default function CopyButton({ text, className = "" }) {
  const [status, setStatus] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const handleCopy = async () => {
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

  const state = STATES[status];

  return (
    <button
      type="button"
      className={`copy-btn${status ? ` is-${status}` : ""}${className ? ` ${className}` : ""}`}
      title={state ? state.title : "Copy"}
      aria-label={state ? state.title : "Copy"}
      onClick={handleCopy}
    >
      <i className={`ph-light ${state ? state.icon : "ph-copy"}`} />
    </button>
  );
}
