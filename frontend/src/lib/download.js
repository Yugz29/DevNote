const INVALID_CHARS = /[\p{Cc}<>:"\\/|?*]/gu;
const RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
const EDGE_CHARS = /^[.\s]+|[.\s]+$/g;
const MAX_LENGTH = 100;

export function toFilename(title, extension, fallback = "document") {
  const cleaned = (title ?? "")
    .replace(INVALID_CHARS, " ")
    .replace(/\s+/g, " ")
    .replace(EDGE_CHARS, "")
    .slice(0, MAX_LENGTH)
    .replace(EDGE_CHARS, "");

  const safe = !cleaned || RESERVED_NAMES.test(cleaned) ? fallback : cleaned;

  return `${safe}.${extension}`;
}

export function downloadTextFile(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
