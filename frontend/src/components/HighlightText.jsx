export default function HighlightText({ text, query }) {
  const value = String(text ?? '')

  if (!query) return value

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)
  const parts = value.split(new RegExp(`(${escaped})`, 'gi'))
  const needle = query.toLowerCase()

  return parts.map((part, index) =>
    part.toLowerCase() === needle ? (
      <mark key={index} className="search-highlight">
        {part}
      </mark>
    ) : (
      part
    ),
  )
}
