export default function NoteOutline({ headings, onSelect }) {
  const shallowest = Math.min(...headings.map((heading) => heading.level));

  return (
    <nav className="note-outline" aria-label="Note outline">
      <ul className="note-outline-list">
        {headings.map((heading) => (
          <li key={heading.id}>
            <button
              type="button"
              className="note-outline-item"
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
