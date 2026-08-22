export function parseDueDate(date, time = null) {
  if (!date) return null;

  const [year, month, day] = date.split("-").map(Number);
  const [hours = 0, minutes = 0] = time ? time.split(":").map(Number) : [];
  const parsed = new Date(year, month - 1, day, hours, minutes);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDueDate(date, time = null) {
  const parsed = parseDueDate(date, time);

  if (parsed === null) return "";

  if (!time) return parsed.toLocaleDateString();

  return `${parsed.toLocaleDateString()} ${parsed.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}
