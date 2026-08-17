import LanguageIcon from "./LanguageIcon.jsx";

export default function SnippetCard({ snippet, onEdit, onDelete }) {
  return (
    <div className="snippet-card" data-id={snippet.id}>
      <div className="snippet-card-header">
        <div className="snippet-lang-badge">
          <LanguageIcon language={snippet.language} />
          <span className="snippet-lang-name">
            {snippet.language || "text"}
          </span>
        </div>

        <div className="item-actions">
          <button
            className="edit-snippet-btn btn-card-icon-action"
            data-id={snippet.id}
            title="Edit"
            onClick={onEdit}
          >
            <i className="ph-light ph-pencil-simple" />
          </button>
          <button
            className="delete-snippet-btn btn-card-icon-action btn-card-icon-danger"
            data-id={snippet.id}
            title="Delete"
            onClick={onDelete}
          >
            <i className="ph-light ph-trash" />
          </button>
        </div>
      </div>

      <h4 className="snippet-title">{snippet.title}</h4>

      {snippet.description && (
        <p className="snippet-description">{snippet.description}</p>
      )}

      <pre className="snippet-preview">
        <code>
          {snippet.content.substring(0, 200)}
          {snippet.content.length > 200 ? "\n..." : ""}
        </code>
      </pre>

      <div className="snippet-card-footer">
        <span className="card-date">
          {new Date(snippet.created_at).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}
