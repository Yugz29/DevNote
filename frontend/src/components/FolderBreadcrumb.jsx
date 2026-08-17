export default function FolderBreadcrumb({
  path,
  isDetail = false,
  onNavigate,
}) {
  const lastIndex = path.length - 1;

  return (
    <nav className="folder-breadcrumb" aria-label="Folder path">
      <button
        type="button"
        className="folder-crumb"
        disabled={path.length === 0 && !isDetail}
        onClick={() => onNavigate(-1)}
      >
        <i className="ph-light ph-house" />
        <span>Root</span>
      </button>

      {path.map((folder, index) => (
        <span className="folder-crumb-group" key={folder.id}>
          <i className="ph-light ph-caret-right folder-crumb-separator" />
          <button
            type="button"
            className="folder-crumb"
            disabled={index === lastIndex && !isDetail}
            onClick={() => onNavigate(index)}
          >
            {folder.name}
          </button>
        </span>
      ))}
    </nav>
  );
}
