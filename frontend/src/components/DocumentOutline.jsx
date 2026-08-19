export default function DocumentOutline({ headings, onSelect }) {
  const shallowest = Math.min(...headings.map((heading) => heading.level));

  return (
    <nav className="document-outline" aria-label="Document outline">
      <ul className="document-outline-list">
        {headings.map((heading) => (
          <li key={heading.id}>
            <button
              type="button"
              className="document-outline-item"
              style={{ "--depth": Math.min(heading.level - shallowest, 3) }}
              title={heading.text}
              onClick={() => onSelect(heading.id)}
            >
              {heading.text || "Untitled heading"}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
