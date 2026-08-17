export default function FolderBreadcrumb({ path, onNavigate }) {
  return (
    <nav className="folder-breadcrumb" aria-label="Folder path">
      <button
        type="button"
        className="folder-crumb"
        disabled={path.length === 0}
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
            disabled={index === path.length - 1}
            onClick={() => onNavigate(index)}
          >
            {folder.name}
          </button>
        </span>
      ))}
    </nav>
  );
}
