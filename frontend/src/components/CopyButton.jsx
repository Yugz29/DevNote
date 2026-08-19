import { useCopyStatus } from "../hooks/useCopyStatus.js";

const STATES = {
  copied: { icon: "ph-check", title: "Copied" },
  failed: { icon: "ph-warning", title: "Copy failed" },
};

export default function CopyButton({ text, className = "" }) {
  const { status, copy } = useCopyStatus();

  const state = STATES[status];

  return (
    <button
      type="button"
      className={`copy-btn${status ? ` is-${status}` : ""}${className ? ` ${className}` : ""}`}
      title={state ? state.title : "Copy"}
      aria-label={state ? state.title : "Copy"}
      onClick={() => copy(text)}
    >
      <i className={`ph-light ${state ? state.icon : "ph-copy"}`} />
    </button>
  );
}
